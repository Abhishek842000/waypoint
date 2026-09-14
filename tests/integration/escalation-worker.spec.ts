import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import {
  closeJobConnections,
  delayedEscalationJobs,
  getRedis,
} from "@waypoint/jobs";
import { bootApp, register, resetDatabase } from "./helpers";

/**
 * Real Redis + a real worker process. These tests prove the delay lives in
 * BullMQ (db 15, isolated from a local demo worker on db 0) — not in RAM.
 * `sleep` here is only the test waiting on Redis; the job delay is `Queue.add({ delay })`.
 */
const REDIS_URL = "redis://127.0.0.1:6379/15";
/** 1 policy minute → 3 seconds, so a 5-minute step would be 15s in this suite. */
const DELAY_MULTIPLIER = String(3 / 60);

function workerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    REDIS_URL,
    ESCALATION_DELAY_MULTIPLIER: DELAY_MULTIPLIER,
    WAYPOINT_JOBS: "bullmq",
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://waypoint:waypoint@localhost:5433/waypoint?schema=public",
  };
}

async function startWorker(): Promise<ChildProcess> {
  const child = spawn("pnpm", ["exec", "tsx", "src/index.ts"], {
    cwd: path.resolve(__dirname, "../../apps/worker"),
    env: workerEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await new Promise<void>((resolve, reject) => {
      let ready = false;
      let logs = "";
      const fail = setTimeout(() => {
        if (!ready) reject(new Error(`worker did not become ready\n${logs}`));
      }, 20_000);
      const onChunk = (buf: Buffer) => {
        logs += buf.toString();
        if (!ready && logs.includes("escalate-incident ready")) {
          ready = true;
          clearTimeout(fail);
          resolve();
        }
      };
      child.stdout?.on("data", onChunk);
      child.stderr?.on("data", onChunk);
      child.once("exit", (code) => {
        if (!ready) {
          clearTimeout(fail);
          reject(new Error(`worker exited ${code} before ready\n${logs}`));
        }
      });
    });
  } catch (err) {
    await stopWorker(child);
    throw err;
  }

  return child;
}

async function stopWorker(child: ChildProcess | null) {
  if (!child || child.killed || child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    void sleep(3_000).then(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    });
  });
}

async function waitUntil(label: string, fn: () => Promise<boolean>, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await sleep(150);
  }
  throw new Error(`timed out waiting for ${label}`);
}

describe("BullMQ escalation survives a worker restart", () => {
  let app: INestApplication;
  let worker: ChildProcess | null = null;

  beforeAll(async () => {
    process.env.WAYPOINT_JOBS = "bullmq";
    process.env.REDIS_URL = REDIS_URL;
    process.env.ESCALATION_DELAY_MULTIPLIER = DELAY_MULTIPLIER;
    await closeJobConnections();
    await getRedis().ping();
    app = await bootApp();
    worker = await startWorker();
  }, 60_000);

  afterAll(async () => {
    await stopWorker(worker);
    worker = null;
    await app.close();
    try {
      await getRedis().flushdb();
    } catch {
      /* ignore */
    }
    await closeJobConnections();
    process.env.WAYPOINT_JOBS = "memory";
    delete process.env.ESCALATION_DELAY_MULTIPLIER;
  });

  beforeEach(async () => {
    await resetDatabase();
    await getRedis().flushdb();
    if (!worker || worker.exitCode !== null) {
      worker = await startWorker();
    }
  });

  async function seed() {
    const admin = await register(app, {
      email: "alice@acme.test",
      password: "password123",
      name: "Alice",
      orgName: "Acme",
    });
    const riley = await admin.agent
      .post("/v1/orgs/members")
      .send({
        email: "riley@acme.test",
        name: "Riley",
        password: "password123",
        role: "responder",
      })
      .expect(201);
    const sam = await admin.agent
      .post("/v1/orgs/members")
      .send({
        email: "sam@acme.test",
        name: "Sam",
        password: "password123",
        role: "responder",
      })
      .expect(201);
    const service = await admin.agent.post("/v1/services").send({ name: "API" }).expect(201);
    const rotation = await admin.agent
      .post("/v1/rotations")
      .send({
        name: "Primary",
        memberUserIds: [admin.body.user.id, riley.body.user.id],
        handoffIntervalDays: 7,
      })
      .expect(201);
    return { admin, riley, sam, service, rotation };
  }

  it(
    "pages every remaining policy step on schedule while the incident stays triggered",
    async () => {
      const { admin, riley, sam, service, rotation } = await seed();
      const policy = await admin.agent
        .post("/v1/escalation-policies")
        .send({
          name: "Three rungs",
          steps: [
            {
              waitMinutes: 1,
              targetType: "rotation",
              targetRotationId: rotation.body.id,
            },
            {
              waitMinutes: 1,
              targetType: "user",
              targetUserId: riley.body.user.id,
            },
            {
              waitMinutes: 1,
              targetType: "user",
              targetUserId: sam.body.user.id,
            },
          ],
        })
        .expect(201);

      const incident = await admin.agent
        .post("/v1/incidents")
        .send({
          serviceId: service.body.id,
          title: "All steps",
          severity: "critical",
          escalationPolicyId: policy.body.id,
        })
        .expect(201);

      expect((await delayedEscalationJobs(incident.body.id)).length).toBe(1);

      await waitUntil("step 1 escalated", async () => {
        const t = await admin.agent.get(`/v1/incidents/${incident.body.id}/timeline`);
        return t.body.filter((e: { type: string }) => e.type === "escalated").length >= 1;
      });

      await waitUntil("step 2 escalated", async () => {
        const t = await admin.agent.get(`/v1/incidents/${incident.body.id}/timeline`);
        return t.body.filter((e: { type: string }) => e.type === "escalated").length >= 2;
      });

      const timeline = await admin.agent
        .get(`/v1/incidents/${incident.body.id}/timeline`)
        .expect(200);
      expect(timeline.body.map((e: { type: string; payload: { step?: number } }) => [e.type, e.payload.step])).toEqual([
        ["triggered", 0],
        ["escalated", 1],
        ["escalated", 2],
      ]);
      const body = await admin.agent.get(`/v1/incidents/${incident.body.id}`).expect(200);
      expect(body.body.status).toBe("triggered");
      expect(body.body.currentEscalationStep).toBe(2);
    },
    40_000,
  );

  it(
    "still escalates after SIGTERM: the delayed job lives in Redis, not the worker process",
    async () => {
      const { admin, riley, service, rotation } = await seed();
      const policy = await admin.agent
        .post("/v1/escalation-policies")
        .send({
          name: "Restart me",
          steps: [
            {
              waitMinutes: 1,
              targetType: "rotation",
              targetRotationId: rotation.body.id,
            },
            {
              waitMinutes: 1,
              targetType: "user",
              targetUserId: riley.body.user.id,
            },
          ],
        })
        .expect(201);

      const incident = await admin.agent
        .post("/v1/incidents")
        .send({
          serviceId: service.body.id,
          title: "Survive restart",
          severity: "high",
          escalationPolicyId: policy.body.id,
        })
        .expect(201);

      const beforeKill = await delayedEscalationJobs(incident.body.id);
      expect(beforeKill.length).toBe(1);
      expect(beforeKill[0]?.opts.delay).toBeGreaterThan(1_000);

      await stopWorker(worker);
      worker = null;

      const stillQueued = await delayedEscalationJobs(incident.body.id);
      expect(stillQueued.length).toBe(1);

      worker = await startWorker();

      await waitUntil("escalation after restart", async () => {
        const t = await admin.agent.get(`/v1/incidents/${incident.body.id}/timeline`);
        return t.body.some((e: { type: string }) => e.type === "escalated");
      });

      const timeline = await admin.agent
        .get(`/v1/incidents/${incident.body.id}/timeline`)
        .expect(200);
      expect(timeline.body.map((e: { type: string }) => e.type)).toEqual([
        "triggered",
        "escalated",
      ]);
    },
    40_000,
  );

  it(
    "cancels the Redis delayed job on acknowledge so a restarted worker cannot page the next step",
    async () => {
      const { admin, riley, service, rotation } = await seed();
      const policy = await admin.agent
        .post("/v1/escalation-policies")
        .send({
          name: "Ack cancels",
          steps: [
            {
              waitMinutes: 1,
              targetType: "rotation",
              targetRotationId: rotation.body.id,
            },
            {
              waitMinutes: 1,
              targetType: "user",
              targetUserId: riley.body.user.id,
            },
          ],
        })
        .expect(201);

      const incident = await admin.agent
        .post("/v1/incidents")
        .send({
          serviceId: service.body.id,
          title: "Ack me",
          severity: "high",
          escalationPolicyId: policy.body.id,
        })
        .expect(201);

      expect((await delayedEscalationJobs(incident.body.id)).length).toBe(1);
      await admin.agent.post(`/v1/incidents/${incident.body.id}/acknowledge`).expect(200);
      expect((await delayedEscalationJobs(incident.body.id)).length).toBe(0);

      await sleep(4_000);
      const timeline = await admin.agent
        .get(`/v1/incidents/${incident.body.id}/timeline`)
        .expect(200);
      expect(timeline.body.map((e: { type: string }) => e.type)).toEqual([
        "triggered",
        "acknowledged",
      ]);
    },
    20_000,
  );
});
