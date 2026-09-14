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

  await Promise.all([
    escalateWorker.waitUntilReady(),
    notifyWorker.waitUntilReady(),
    rotationWorker.waitUntilReady(),
  ]);

  escalateWorker.on("failed", (job, err) =>
    console.error("[worker] escalate failed", job?.id, err),
  );
  notifyWorker.on("failed", (job, err) =>
    console.error("[worker] notify failed", job?.id, err),
  );
  rotationWorker.on("failed", (job, err) =>
    console.error("[worker] rotation advance failed", job?.id, err),
  );

  const multiplier = Number(process.env.ESCALATION_DELAY_MULTIPLIER ?? 1);
  console.log("[worker] escalate-incident ready");
  console.log(
    `Waypoint worker started (escalation delay multiplier=${Number.isFinite(multiplier) ? multiplier : 1})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
