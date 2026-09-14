import IORedis from "ioredis";
import { Queue } from "bullmq";
import {
  DELIVER_NOTIFICATION_JOB,
  ESCALATE_INCIDENT_JOB,
} from "@waypoint/shared-types";

let connection: IORedis | null = null;
let escalateQueue: Queue | null = null;
let notifyQueue: Queue | null = null;

export function getRedis(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

export function getEscalateQueue(): Queue {
  if (!escalateQueue) {
    escalateQueue = new Queue(ESCALATE_INCIDENT_JOB, { connection: getRedis() });
  }
  return escalateQueue;
}

export function getNotifyQueue(): Queue {
  if (!notifyQueue) {
    notifyQueue = new Queue(DELIVER_NOTIFICATION_JOB, { connection: getRedis() });
  }
  return notifyQueue;
}

export async function closeJobConnections(): Promise<void> {
  await Promise.all([
    escalateQueue?.close(),
    notifyQueue?.close(),
    connection?.quit(),
  ]);
  escalateQueue = null;
  notifyQueue = null;
  connection = null;
}
