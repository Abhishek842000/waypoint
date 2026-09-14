import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import type { OrgRealtimeEvent, PublicStatusPayload } from "@waypoint/shared-types";
import {
  PUBLIC_STATUS_INCIDENT_KEYS,
  PUBLIC_STATUS_ORG_KEYS,
  PUBLIC_STATUS_ROOT_KEYS,
  PUBLIC_STATUS_SERVICE_KEYS,
} from "@waypoint/shared-types";
import { bootApp, cookiesFrom, register, resetDatabase } from "./helpers";

function parseSseBlocks(buffer: string): { events: OrgRealtimeEvent[]; rest: string } {
  const events: OrgRealtimeEvent[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const block of parts) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as OrgRealtimeEvent);
    } catch {
      /* ignore comments / retries */
    }
  }
  return { events, rest };
}

function waitMs(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitUntil<T>(
  read: () => T | undefined,
  timeoutMs = 4000,
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = read();
    if (value !== undefined) return value;
    await waitMs(20);
  }
  throw new Error("timed out waiting for SSE event");
}

type SseHandle = {
  events: OrgRealtimeEvent[];
  close: () => void;
};

async function ssePort(app: INestApplication): Promise<number> {
  const server = app.getHttpServer() as { listening?: boolean };
  if (!server.listening) {
    await app.listen(0, "127.0.0.1");
  }
  const addr = app.getHttpServer().address() as AddressInfo;
  return addr.port;
}

async function openOrgSse(
  app: INestApplication,
  cookies: string,
  path = "/v1/realtime/incidents",
): Promise<SseHandle> {
  const port = await ssePort(app);
  const events: OrgRealtimeEvent[] = [];
  let rest = "";

  const req = httpRequest(
    {
      hostname: "127.0.0.1",
      port,
      path,
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        Cookie: cookies,
      },
    },
    (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return;
      }
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        rest += chunk;
        const parsed = parseSseBlocks(rest);
        rest = parsed.rest;
        events.push(...parsed.events);
      });
    },
  );
  req.end();

  await waitUntil(() => events.find((e) => e.type === "connected"));

  return {
    events,
    close: () => req.destroy(),
  };
}

function collectKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, into);
    return into;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      collectKeys(child, into);
    }
  }
  return into;
}

describe("realtime SSE and public status isolation", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("requires authentication for the incident stream", async () => {
    await request(app.getHttpServer())
      .get("/v1/realtime/incidents")
      .set("Accept", "text/event-stream")
      .expect(401);
  });

  it("pushes incident.event to other sessions in the same org without a refresh", async () => {
    const alice = await register(app, {
      email: "alice@acme.test",
      password: "password123",
      name: "Alice",
      orgName: "Acme",
    });
    await alice.agent
      .post("/v1/orgs/members")
      .send({
        email: "riley@acme.test",
        name: "Riley",
        password: "password123",
        role: "responder",
      })
      .expect(201);
    const riley = request.agent(app.getHttpServer());
    const rileyLogin = await riley
      .post("/v1/auth/login")
      .send({ email: "riley@acme.test", password: "password123" })
      .expect(200);

    const service = await alice.agent.post("/v1/services").send({ name: "API" }).expect(201);
    const created = await alice.agent
      .post("/v1/incidents")
      .send({ serviceId: service.body.id, title: "Checkout 500s", severity: "critical" })
      .expect(201);

    const rileyStream = await openOrgSse(app, cookiesFrom(rileyLogin));
    try {
      await alice.agent.post(`/v1/incidents/${created.body.id}/acknowledge`).expect(200);
      const event = await waitUntil(() =>
        rileyStream.events.find(
          (e) =>
            e.type === "incident.event" &&
            e.incidentId === created.body.id &&
            e.eventType === "acknowledged",
        ),
      );
      expect(event.status).toBe("acknowledged");
      expect(JSON.stringify(event)).not.toMatch(/riley@acme\.test/i);
      expect(JSON.stringify(event)).not.toMatch(/Alice/);
    } finally {
      rileyStream.close();
    }
  });

  it("does not leak another org's events even if the client passes their orgId", async () => {
    const acme = await register(app, {
      email: "alice@acme.test",
      password: "password123",
      name: "Alice",
      orgName: "Acme",
    });
    const globex = await register(app, {
      email: "bob@globex.test",
      password: "password123",
      name: "Bob",
      orgName: "Globex",
    });

    const globexStream = await openOrgSse(
      app,
      globex.cookies,
      `/v1/realtime/incidents?orgId=${acme.body.org.id}`,
    );
    try {
      const service = await acme.agent.post("/v1/services").send({ name: "API" }).expect(201);
      await acme.agent
        .post("/v1/incidents")
        .send({ serviceId: service.body.id, title: "Acme secret outage", severity: "high" })
        .expect(201);

      await waitMs(200);
      expect(globexStream.events.filter((e) => e.type === "incident.event")).toEqual([]);
      expect(globexStream.events.every((e) => e.orgId === globex.body.org.id)).toBe(true);
    } finally {
      globexStream.close();
    }
  });

  it("is readable without auth, stays on the slug's org, and never exposes members or emails", async () => {
    const acme = await register(app, {
      email: "alice@acme.test",
      password: "password123",
      name: "Alice",
      orgName: "Acme",
    });
    const globex = await register(app, {
      email: "bob@globex.test",
      password: "password123",
      name: "Bob",
      orgName: "Globex",
    });

    const acmeService = await acme.agent.post("/v1/services").send({ name: "Acme API" }).expect(201);
    await globex.agent.post("/v1/services").send({ name: "Globex Web" }).expect(201);

    const open = await acme.agent
      .post("/v1/incidents")
      .send({
        serviceId: acmeService.body.id,
        title: "Acme checkout 500s",
        severity: "critical",
      })
      .expect(201);
    await acme.agent.post(`/v1/incidents/${open.body.id}/acknowledge`).expect(200);

    const resolved = await acme.agent
      .post("/v1/incidents")
      .send({
        serviceId: acmeService.body.id,
        title: "Acme prior blip",
        severity: "low",
      })
      .expect(201);
    await acme.agent.post(`/v1/incidents/${resolved.body.id}/resolve`).expect(200);

    const anonymous = request(app.getHttpServer());
    const acmeStatus = await anonymous
      .get(`/v1/public/status/${acme.body.org.slug}`)
      .expect(200);

    const payload = acmeStatus.body as PublicStatusPayload;
    expect(payload.org).toEqual({ name: "Acme", slug: acme.body.org.slug });
    expect(payload.services).toHaveLength(1);
    expect(payload.services[0]?.name).toBe("Acme API");
    expect(payload.services[0]?.currentStatus).toBe("major_outage");
    expect(payload.incidents.map((i) => i.title).sort()).toEqual([
      "Acme checkout 500s",
      "Acme prior blip",
    ]);
    expect(payload.incidents.some((i) => i.status === "resolved")).toBe(true);
    expect(payload.incidents.some((i) => i.status === "acknowledged")).toBe(true);

    expect(Object.keys(payload).sort()).toEqual([...PUBLIC_STATUS_ROOT_KEYS].sort());
    expect(Object.keys(payload.org).sort()).toEqual([...PUBLIC_STATUS_ORG_KEYS].sort());
    expect(Object.keys(payload.services[0]!).sort()).toEqual(
      [...PUBLIC_STATUS_SERVICE_KEYS].sort(),
    );
    expect(Object.keys(payload.incidents[0]!).sort()).toEqual(
      [...PUBLIC_STATUS_INCIDENT_KEYS].sort(),
    );

    const keys = collectKeys(payload);
    expect(keys.has("email")).toBe(false);
    expect(keys.has("name")).toBe(true); // org + service names only
    expect(keys.has("acknowledgedById")).toBe(false);
    expect(keys.has("actorId")).toBe(false);
    expect(keys.has("passwordHash")).toBe(false);
    expect(keys.has("targetLabel")).toBe(false);
    expect(keys.has("payload")).toBe(false);

    const json = JSON.stringify(payload);
    expect(json).not.toMatch(/alice@acme\.test/i);
    expect(json).not.toMatch(/bob@globex\.test/i);
    expect(json).not.toMatch(/Alice/);
    expect(json).not.toMatch(/Riley/);
    expect(json).not.toMatch(/password/i);

    const globexStatus = await anonymous
      .get(`/v1/public/status/${globex.body.org.slug}`)
      .expect(200);
    expect(globexStatus.body.services.map((s: { name: string }) => s.name)).toEqual([
      "Globex Web",
    ]);
    expect(globexStatus.body.incidents).toEqual([]);
    expect(JSON.stringify(globexStatus.body)).not.toMatch(/Acme checkout/);
    expect(JSON.stringify(globexStatus.body)).not.toMatch(/Acme API/);

    await anonymous.get("/v1/public/status/does-not-exist").expect(404);
  });
});
