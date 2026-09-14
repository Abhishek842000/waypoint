import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { unscopedDb } from "@waypoint/db";
import { getFakeJobClock, resetCapturedNotificationPosts, resetRealtimeBus } from "@waypoint/jobs";
import { createApp } from "../../apps/api/src/main";

export async function resetDatabase() {
  getFakeJobClock().reset();
  resetCapturedNotificationPosts();
  resetRealtimeBus();
  await unscopedDb().$executeRawUnsafe(`
    TRUNCATE TABLE
      "IncidentEvent",
      "Incident",
      "NotificationChannel",
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

export function cookiesFrom(res: { headers: { "set-cookie"?: string[] | string } }): string {
  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list
    .map((part) => part.split(";")[0] ?? "")
    .filter(Boolean)
    .join("; ");
}

export async function register(app: INestApplication, body: RegisterBody) {
  const agent = request.agent(app.getHttpServer());
  const res = await agent.post("/v1/auth/register").send(body).expect(201);
  return {
    agent,
    cookies: cookiesFrom(res),
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
