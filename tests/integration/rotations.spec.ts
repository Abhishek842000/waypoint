import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { bootApp, login, register, resetDatabase } from "./helpers";

describe("rotations and escalation policies", () => {
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

  it("stores a 3-person rotation and a 2-step policy with correct order and targets", async () => {
    const admin = await register(app, {
      email: "admin@acme.test",
      password: "password123",
      name: "Admin",
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

    const rotation = await admin.agent
      .post("/v1/rotations")
      .send({
        name: "Primary",
        memberUserIds: [admin.body.user.id, riley.body.user.id, sam.body.user.id],
        handoffIntervalDays: 7,
      })
      .expect(201);

    expect(rotation.body.members.map((m: { userId: string }) => m.userId)).toEqual([
      admin.body.user.id,
      riley.body.user.id,
      sam.body.user.id,
    ]);
    expect(rotation.body.members.map((m: { position: number }) => m.position)).toEqual([
      0, 1, 2,
    ]);
    expect(rotation.body.currentlyOnCall.userId).toBe(admin.body.user.id);

    const policy = await admin.agent
      .post("/v1/escalation-policies")
      .send({
        name: "Page primary then Sam",
        steps: [
          {
            waitMinutes: 5,
            targetType: "rotation",
            targetRotationId: rotation.body.id,
          },
          {
            waitMinutes: 5,
            targetType: "user",
            targetUserId: sam.body.user.id,
          },
        ],
      })
      .expect(201);

    expect(policy.body.steps).toHaveLength(2);
    expect(policy.body.steps[0].stepOrder).toBe(0);
    expect(policy.body.steps[0].targetType).toBe("rotation");
    expect(policy.body.steps[0].targetRotationId).toBe(rotation.body.id);
    expect(policy.body.steps[0].isTerminal).toBe(false);
    expect(policy.body.steps[0].resolvedTarget).toMatchObject({
      kind: "rotation",
      userId: admin.body.user.id,
    });
    expect(policy.body.steps[1].stepOrder).toBe(1);
    expect(policy.body.steps[1].targetType).toBe("user");
    expect(policy.body.steps[1].targetUserId).toBe(sam.body.user.id);
    expect(policy.body.steps[1].isTerminal).toBe(true);

    const stored = await admin.agent
      .get(`/v1/escalation-policies/${policy.body.id}`)
      .expect(200);
    expect(stored.body.steps.map((s: { stepOrder: number }) => s.stepOrder)).toEqual([0, 1]);
  });

  it("returns 404 when org B reads org A's rotation or policy", async () => {
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

    const rotation = await acme.agent
      .post("/v1/rotations")
      .send({ name: "Acme on-call", memberUserIds: [acme.body.user.id] })
      .expect(201);

    const policy = await acme.agent
      .post("/v1/escalation-policies")
      .send({
        name: "Acme policy",
        steps: [
          {
            waitMinutes: 5,
            targetType: "user",
            targetUserId: acme.body.user.id,
          },
        ],
      })
      .expect(201);

    expect((await globex.agent.get(`/v1/rotations/${rotation.body.id}`)).status).toBe(404);
    expect((await globex.agent.get(`/v1/escalation-policies/${policy.body.id}`)).status).toBe(
      404,
    );
    expect((await globex.agent.get("/v1/rotations").expect(200)).body).toEqual([]);
  });

  it("blocks a viewer from creating rotations and policies", async () => {
    const admin = await register(app, {
      email: "admin@acme.test",
      password: "password123",
      name: "Admin",
      orgName: "Acme",
    });
    await admin.agent
      .post("/v1/orgs/members")
      .send({
        email: "viewer@acme.test",
        name: "Vera",
        password: "password123",
        role: "viewer",
      })
      .expect(201);

    const viewer = await login(app, {
      email: "viewer@acme.test",
      password: "password123",
    });

    await viewer.get("/v1/rotations").expect(200);

    const deniedRotation = await viewer.post("/v1/rotations").send({
      name: "Nope",
      memberUserIds: [admin.body.user.id],
    });
    expect(deniedRotation.status).toBe(403);
    expect(deniedRotation.body.message).toMatch(/rotation:create/i);

    const deniedPolicy = await viewer.post("/v1/escalation-policies").send({
      name: "Nope",
      steps: [
        { waitMinutes: 5, targetType: "user", targetUserId: admin.body.user.id },
      ],
    });
    expect(deniedPolicy.status).toBe(403);
    expect(deniedPolicy.body.message).toMatch(/escalation_policy:create/i);
  });
});
