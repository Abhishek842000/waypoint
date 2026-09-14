import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { bootApp, register, resetDatabase } from "./helpers";

describe("tenancy isolation", () => {
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

  it("returns 404 (not empty) when org B reads org A's incident", async () => {
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

    const service = await acme.agent
      .post("/v1/services")
      .send({ name: "Payments API" })
      .expect(201);

    const incident = await acme.agent
      .post("/v1/incidents")
      .send({ serviceId: service.body.id, title: "Checkout 500s", severity: "high" })
      .expect(201);

    await acme.agent.get(`/v1/incidents/${incident.body.id}`).expect(200);

    const crossRead = await globex.agent.get(`/v1/incidents/${incident.body.id}`);
    expect(crossRead.status).toBe(404);
    expect(crossRead.body.message).toMatch(/not found/i);

    const crossWrite = await globex.agent.post(
      `/v1/incidents/${incident.body.id}/acknowledge`,
    );
    expect(crossWrite.status).toBe(404);

    const globexList = await globex.agent.get("/v1/incidents").expect(200);
    expect(globexList.body).toEqual([]);

    const globexServices = await globex.agent.get("/v1/services").expect(200);
    expect(globexServices.body).toEqual([]);
  });

  it("cannot create a service into another org by stuffing orgId into the body", async () => {
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

    await globex.agent
      .post("/v1/services")
      .send({ name: "Globex Web", orgId: acme.body.org.id })
      .expect(201);

    const acmeServices = await acme.agent.get("/v1/services").expect(200);
    expect(acmeServices.body).toHaveLength(0);

    const globexServices = await globex.agent.get("/v1/services").expect(200);
    expect(globexServices.body).toHaveLength(1);
    expect(globexServices.body[0].orgId).toBe(globex.body.org.id);
  });

  it("public status page is scoped to the slug's org", async () => {
    const acme = await register(app, {
      email: "alice@acme.test",
      password: "password123",
      name: "Alice",
      orgName: "Acme",
    });
    await register(app, {
      email: "bob@globex.test",
      password: "password123",
      name: "Bob",
      orgName: "Globex",
    });

    await acme.agent.post("/v1/services").send({ name: "API" }).expect(201);

    const acmeStatus = await acme.agent
      .get(`/v1/public/status/${acme.body.org.slug}`)
      .expect(200);
    expect(acmeStatus.body.services).toHaveLength(1);

    const missing = await acme.agent.get("/v1/public/status/does-not-exist");
    expect(missing.status).toBe(404);
  });
});
