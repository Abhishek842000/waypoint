import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { capturedNotificationPosts, getFakeJobClock } from "@waypoint/jobs";
import { bootApp, login, register, resetDatabase } from "./helpers";

describe("incident state machine, timeline, escalation, notifications", () => {
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

  async function seedOrg() {
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
    await admin.agent
      .post("/v1/orgs/members")
      .send({
        email: "vera@acme.test",
        name: "Vera",
        password: "password123",
        role: "viewer",
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
    const policy = await admin.agent
      .post("/v1/escalation-policies")
      .send({
        name: "Page primary then Riley",
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
    await admin.agent
      .post("/v1/notification-channels")
      .send({
        name: "On-call slack",
        type: "slack",
        config: { webhookUrl: "https://hooks.slack.test/services/demo" },
      })
      .expect(201);
    return { admin, service, policy };
  }

  it("writes a timeline event on trigger, fires Slack, and pages the next step after the wait", async () => {
    const { admin, service, policy } = await seedOrg();

    const incident = await admin.agent
      .post("/v1/incidents")
      .send({
        serviceId: service.body.id,
        title: "Checkout 500s",
        severity: "critical",
        escalationPolicyId: policy.body.id,
      })
      .expect(201);

    expect(incident.body.status).toBe("triggered");
    const posts = capturedNotificationPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toContain("hooks.slack.test");
    expect(posts[0]?.body).toMatch(/Checkout 500s/);

    const timeline = await admin.agent
      .get(`/v1/incidents/${incident.body.id}/timeline`)
      .expect(200);
    expect(timeline.body.map((e: { type: string }) => e.type)).toEqual(["triggered"]);
    expect(timeline.body[0].payload.notifications[0].status).toBe("sent");
    expect(timeline.body[0].payload.targetLabel).toMatch(/Alice/);

    await getFakeJobClock().elapse(59_000);
    const still = await admin.agent
      .get(`/v1/incidents/${incident.body.id}/timeline`)
      .expect(200);
    expect(still.body).toHaveLength(1);

    await getFakeJobClock().elapse(1_000);
    const escalated = await admin.agent
      .get(`/v1/incidents/${incident.body.id}/timeline`)
      .expect(200);
    expect(escalated.body.map((e: { type: string }) => e.type)).toEqual([
      "triggered",
      "escalated",
    ]);
    expect(escalated.body[1].payload.step).toBe(1);
    expect(escalated.body[1].payload.targetLabel).toMatch(/Riley/);
    expect(capturedNotificationPosts()).toHaveLength(2);

    const after = await admin.agent.get(`/v1/incidents/${incident.body.id}`).expect(200);
    expect(after.body.currentEscalationStep).toBe(1);
  });

  it("cancels pending escalation when a responder acknowledges", async () => {
    const { admin, service, policy } = await seedOrg();
    const incident = await admin.agent
      .post("/v1/incidents")
      .send({
        serviceId: service.body.id,
        title: "Latency",
        severity: "high",
        escalationPolicyId: policy.body.id,
      })
      .expect(201);

    const responder = await login(app, {
      email: "riley@acme.test",
      password: "password123",
    });
    await responder.post(`/v1/incidents/${incident.body.id}/acknowledge`).expect(200);

    await getFakeJobClock().elapse(120_000);
    const timeline = await admin.agent
      .get(`/v1/incidents/${incident.body.id}/timeline`)
      .expect(200);
    expect(timeline.body.map((e: { type: string }) => e.type)).toEqual([
      "triggered",
      "acknowledged",
    ]);
  });

  it("returns 409 when acknowledging an already-resolved incident", async () => {
    const { admin, service } = await seedOrg();
    const incident = await admin.agent
      .post("/v1/incidents")
      .send({ serviceId: service.body.id, title: "Blip", severity: "low" })
      .expect(201);

    await admin.agent.post(`/v1/incidents/${incident.body.id}/resolve`).expect(200);
    const again = await admin.agent.post(`/v1/incidents/${incident.body.id}/acknowledge`);
    expect(again.status).toBe(409);
    expect(again.body.message).toMatch(/cannot be acknowledged/i);
  });

  it("returns 403 when a viewer acknowledges, and 404 for another org's timeline", async () => {
    const { admin, service } = await seedOrg();
    const incident = await admin.agent
      .post("/v1/incidents")
      .send({ serviceId: service.body.id, title: "Pager", severity: "high" })
      .expect(201);

    const viewer = await login(app, {
      email: "vera@acme.test",
      password: "password123",
    });
    const denied = await viewer.post(`/v1/incidents/${incident.body.id}/acknowledge`);
    expect(denied.status).toBe(403);
    expect(denied.body.message).toMatch(/incident:acknowledge/i);

    await viewer.get(`/v1/incidents/${incident.body.id}/timeline`).expect(200);

    const globex = await register(app, {
      email: "bob@globex.test",
      password: "password123",
      name: "Bob",
      orgName: "Globex",
    });
    const cross = await globex.agent.get(`/v1/incidents/${incident.body.id}/timeline`);
    expect(cross.status).toBe(404);

    const channelDenied = await viewer.post("/v1/notification-channels").send({
      name: "nope",
      type: "slack",
      config: { webhookUrl: "https://hooks.slack.test/x" },
    });
    expect(channelDenied.status).toBe(403);
  });

  it("lets an API key trigger an incident that pages Slack", async () => {
    const { admin, service, policy } = await seedOrg();
    const key = await admin.agent
      .post("/v1/api-keys")
      .send({ name: "monitor", scopes: ["incident:create", "incident:read"] })
      .expect(201);

    const viaKey = await request(app.getHttpServer())
      .post("/v1/incidents")
      .set("Authorization", `Bearer ${key.body.plaintext}`)
      .send({
        serviceId: service.body.id,
        title: "From curl",
        severity: "critical",
        escalationPolicyId: policy.body.id,
      })
      .expect(201);

    expect(viaKey.body.title).toBe("From curl");
    expect(capturedNotificationPosts().some((p) => p.body.includes("From curl"))).toBe(true);

    const timeline = await request(app.getHttpServer())
      .get(`/v1/incidents/${viaKey.body.id}/timeline`)
      .set("Authorization", `Bearer ${key.body.plaintext}`)
      .expect(200);
    expect(timeline.body[0].type).toBe("triggered");
  });
});
