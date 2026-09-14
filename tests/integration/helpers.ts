import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { unscopedDb } from "@waypoint/db";
import { createApp } from "../../apps/api/src/main";

export async function resetDatabase() {
  await unscopedDb().$executeRawUnsafe(`
    TRUNCATE TABLE
      "IncidentEvent",
      "Incident",
      "ApiKey",
      "EscalationStep",
      "EscalationPolicy",
      "RotationMember",
      "Rotation",
      "Service",
      "Membership",
      "Org",
      "User"
    CASCADE
  `);
}

export async function bootApp(): Promise<INestApplication> {
  const app = await createApp();
  await app.init();
  return app;
}

type RegisterBody = {
  email: string;
  password: string;
  name: string;
  orgName: string;
};

export async function register(app: INestApplication, body: RegisterBody) {
  const agent = request.agent(app.getHttpServer());
  const res = await agent.post("/v1/auth/register").send(body).expect(201);
  return {
    agent,
    body: res.body as {
      org: { id: string; slug: string; name: string };
      user: { id: string; email: string };
      role: string;
    },
  };
}

export async function login(
  app: INestApplication,
  creds: { email: string; password: string },
) {
  const agent = request.agent(app.getHttpServer());
  await agent.post("/v1/auth/login").send(creds).expect(200);
  return agent;
}
