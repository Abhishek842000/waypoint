import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runWithTenant, unscopedDb } from "@waypoint/db";
import { currentlyOnCall } from "@waypoint/shared-types";
import { advanceDueRotations } from "../../apps/worker/src/jobs/advance-rotations.job";
import { bootApp, register, resetDatabase } from "./helpers";
import type { INestApplication } from "@nestjs/common";

describe("rotation handoff via worker", () => {
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

  it("advances the round-robin pointer when the handoff interval has elapsed", async () => {
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

    const rotation = await admin.agent
      .post("/v1/rotations")
      .send({
        name: "Weekly",
        memberUserIds: [admin.body.user.id, riley.body.user.id],
        handoffIntervalDays: 7,
      })
      .expect(201);

    expect(rotation.body.currentlyOnCall.userId).toBe(admin.body.user.id);

    await runWithTenant(admin.body.org.id, async () => {
      await unscopedDb().rotation.update({
        where: { id: rotation.body.id },
        data: { lastHandoffAt: new Date("2026-01-01T00:00:00.000Z") },
      });
    });

    const advanced = await advanceDueRotations(new Date("2026-01-09T00:00:00.000Z"));
    expect(advanced).toBe(1);

    const after = await admin.agent.get(`/v1/rotations/${rotation.body.id}`).expect(200);
    expect(after.body.currentPointer).toBe(1);
    expect(after.body.currentlyOnCall.userId).toBe(riley.body.user.id);
    expect(
      currentlyOnCall(after.body.members, after.body.currentPointer)?.userId,
    ).toBe(riley.body.user.id);
  });
});
