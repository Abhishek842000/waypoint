import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import {
  ADVANCE_ROTATIONS_JOB,
  advanceRotationsJob,
} from "./jobs/advance-rotations.job";
import {
  DELIVER_NOTIFICATION_JOB,
  deliverNotification,
} from "./jobs/deliver-notification.job";
import {
  ESCALATE_INCIDENT_JOB,
  escalateIncident,
} from "./jobs/escalate-incident.job";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

async function main() {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  const escalateWorker = new Worker(ESCALATE_INCIDENT_JOB, escalateIncident, {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  });
  const notifyWorker = new Worker(DELIVER_NOTIFICATION_JOB, deliverNotification, {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  });
  const rotationWorker = new Worker(ADVANCE_ROTATIONS_JOB, advanceRotationsJob, {
    connection,
    concurrency: 1,
  });

  const rotationQueue = new Queue(ADVANCE_ROTATIONS_JOB, { connection });
  await rotationQueue.add(
    "tick",
    {},
    {
      repeat: { every: 60_000 },
      jobId: "advance-rotations-tick",
    },
  );

  escalateWorker.on("ready", () => console.log("[worker] escalate-incident ready"));
  notifyWorker.on("ready", () => console.log("[worker] deliver-notification ready"));
  rotationWorker.on("ready", () => console.log("[worker] advance-rotations ready"));
  escalateWorker.on("failed", (job, err) =>
    console.error("[worker] escalate failed", job?.id, err),
  );
  notifyWorker.on("failed", (job, err) =>
    console.error("[worker] notify failed", job?.id, err),
  );
  rotationWorker.on("failed", (job, err) =>
    console.error("[worker] rotation advance failed", job?.id, err),
  );

  console.log("Waypoint worker started");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
