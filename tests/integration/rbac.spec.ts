import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { bootApp, login, register, resetDatabase } from "./helpers";

describe("RBAC boundary", () => {
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

  it("blocks a viewer from responder-only mutations and allows reads", async () => {
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
        name: "Vera Viewer",
        password: "password123",
        role: "viewer",
      })
      .expect(201);

    const service = await admin.agent
      .post("/v1/services")
      .send({ name: "Website" })
      .expect(201);

    const incident = await admin.agent
      .post("/v1/incidents")
      .send({ serviceId: service.body.id, title: "Homepage down", severity: "critical" })
      .expect(201);

    const viewer = await login(app, {
      email: "viewer@acme.test",
      password: "password123",
    });

    await viewer.get("/v1/incidents").expect(200);
    await viewer.get(`/v1/incidents/${incident.body.id}`).expect(200);

    const createDenied = await viewer.post("/v1/services").send({ name: "Secret" });
    expect(createDenied.status).toBe(403);
    expect(createDenied.body.message).toMatch(/service:create/i);

    const ackDenied = await viewer.post(`/v1/incidents/${incident.body.id}/acknowledge`);
    expect(ackDenied.status).toBe(403);
    expect(ackDenied.body.message).toMatch(/incident:acknowledge/i);

    const resolveDenied = await viewer.post(`/v1/incidents/${incident.body.id}/resolve`);
    expect(resolveDenied.status).toBe(403);

    const inviteDenied = await viewer.post("/v1/orgs/members").send({
      email: "other@acme.test",
      name: "Other",
      password: "password123",
      role: "admin",
    });
    expect(inviteDenied.status).toBe(403);

    await admin.agent
      .post(`/v1/incidents/${incident.body.id}/acknowledge`)
      .expect(200);
  });

  it("lets a responder acknowledge but not invite members", async () => {
    const admin = await register(app, {
      email: "admin@acme.test",
      password: "password123",
      name: "Admin",
      orgName: "Acme",
    });

    await admin.agent
      .post("/v1/orgs/members")
      .send({
        email: "oncall@acme.test",
        name: "Riley Responder",
        password: "password123",
        role: "responder",
      })
      .expect(201);

    const service = await admin.agent
      .post("/v1/services")
      .send({ name: "API" })
      .expect(201);

    const incident = await admin.agent
      .post("/v1/incidents")
      .send({ serviceId: service.body.id, title: "Latency", severity: "high" })
      .expect(201);

    const responder = await login(app, {
      email: "oncall@acme.test",
      password: "password123",
    });

    await responder.post(`/v1/incidents/${incident.body.id}/acknowledge`).expect(200);

    const inviteDenied = await responder.post("/v1/orgs/members").send({
      email: "x@acme.test",
      name: "X",
      password: "password123",
      role: "viewer",
    });
    expect(inviteDenied.status).toBe(403);
    expect(inviteDenied.body.message).toMatch(/membership:invite/i);
  });

  it("authenticates an API key and enforces its scopes", async () => {
    const admin = await register(app, {
      email: "admin@acme.test",
      password: "password123",
      name: "Admin",
      orgName: "Acme",
    });

    const service = await admin.agent
      .post("/v1/services")
      .send({ name: "API" })
      .expect(201);

    const created = await admin.agent
      .post("/v1/api-keys")
      .send({ name: "pager", scopes: ["incident:create", "incident:read"] })
      .expect(201);

    const plaintext = created.body.plaintext as string;
    expect(plaintext.startsWith("wp_live_")).toBe(true);

    const http = app.getHttpServer();
    const viaKey = await request(http)
      .post("/v1/incidents")
      .set("Authorization", `Bearer ${plaintext}`)
      .send({ serviceId: service.body.id, title: "From webhook", severity: "low" })
      .expect(201);
    expect(viaKey.body.title).toBe("From webhook");

    const ackDenied = await request(http)
      .post(`/v1/incidents/${viaKey.body.id}/acknowledge`)
      .set("Authorization", `Bearer ${plaintext}`);
    expect(ackDenied.status).toBe(403);
    expect(ackDenied.body.message).toMatch(/incident:acknowledge/i);
  });
});
