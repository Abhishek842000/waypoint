import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { bootApp, register, resetDatabase } from "./helpers";

describe("API-key incident create rate limit", () => {
  let app: INestApplication;
  const previousLimit = process.env.INCIDENT_CREATE_RATE_LIMIT;
  const previousWindow = process.env.INCIDENT_CREATE_RATE_WINDOW_MS;

  beforeAll(async () => {
    process.env.INCIDENT_CREATE_RATE_LIMIT = "2";
    process.env.INCIDENT_CREATE_RATE_WINDOW_MS = "60000";
    app = await bootApp();
  });

  afterAll(async () => {
    if (previousLimit === undefined) delete process.env.INCIDENT_CREATE_RATE_LIMIT;
    else process.env.INCIDENT_CREATE_RATE_LIMIT = previousLimit;
    if (previousWindow === undefined) delete process.env.INCIDENT_CREATE_RATE_WINDOW_MS;
    else process.env.INCIDENT_CREATE_RATE_WINDOW_MS = previousWindow;
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(() => {
    process.env.INCIDENT_CREATE_RATE_LIMIT = "2";
  });

  it("returns 429 for a third API-key create in the window and does not throttle session creates", async () => {
    const acme = await register(app, {
      email: "alice@acme.test",
      password: "password123",
      name: "Alice",
      orgName: "Acme",
    });
    const service = await acme.agent.post("/v1/services").send({ name: "API" }).expect(201);
    const key = await acme.agent
      .post("/v1/api-keys")
      .send({ name: "monitor", scopes: ["incident:create", "incident:read"] })
      .expect(201);

    const payload = {
      serviceId: service.body.id,
      title: "From monitor",
      severity: "high",
    };

    await request(app.getHttpServer())
      .post("/v1/incidents")
      .set("x-api-key", key.body.plaintext)
      .send({ ...payload, title: "From monitor 1" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/v1/incidents")
      .set("Authorization", `Bearer ${key.body.plaintext}`)
      .send({ ...payload, title: "From monitor 2" })
      .expect(201);

    const limited = await request(app.getHttpServer())
      .post("/v1/incidents")
      .set("x-api-key", key.body.plaintext)
      .send({ ...payload, title: "From monitor 3" });
    expect(limited.status).toBe(429);
    expect(limited.headers["retry-after"]).toBeTruthy();
    expect(limited.headers["x-ratelimit-remaining"]).toBe("0");
    expect(limited.body.message).toMatch(/rate limit/i);

    await acme.agent
      .post("/v1/incidents")
      .send({ ...payload, title: "From session" })
      .expect(201);

    const list = await acme.agent.get("/v1/incidents").expect(200);
    expect(list.body.map((i: { title: string }) => i.title).sort()).toEqual([
      "From monitor 1",
      "From monitor 2",
      "From session",
    ]);
  });

  it("still requires incident:create — a read-only key is 403, not a free pass around the limiter", async () => {
    const acme = await register(app, {
      email: "alice@acme.test",
      password: "password123",
      name: "Alice",
      orgName: "Acme",
    });
    const service = await acme.agent.post("/v1/services").send({ name: "API" }).expect(201);
    const key = await acme.agent
      .post("/v1/api-keys")
      .send({ name: "readonly", scopes: ["incident:read"] })
      .expect(201);

    const denied = await request(app.getHttpServer())
      .post("/v1/incidents")
      .set("x-api-key", key.body.plaintext)
      .send({ serviceId: service.body.id, title: "Nope", severity: "low" });
    expect(denied.status).toBe(403);
  });
});
