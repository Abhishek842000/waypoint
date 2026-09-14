import type { Job } from "bullmq";
import { DELIVER_NOTIFICATION_JOB } from "@waypoint/shared-types";

export { DELIVER_NOTIFICATION_JOB };

export type DeliverNotificationPayload = {
  orgId: string;
  incidentId: string;
  channel: "slack" | "email" | "webhook";
  target: string;
};

export async function deliverNotification(
  job: Job<DeliverNotificationPayload>,
): Promise<void> {
  console.log(
    `[worker] deliver-notification received job ${job.id} channel=${job.data.channel} incident=${job.data.incidentId}`,
  );
}
