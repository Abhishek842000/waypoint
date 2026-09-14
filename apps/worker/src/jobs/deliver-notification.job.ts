import type { Job } from "bullmq";
import { DELIVER_NOTIFICATION_JOB, type DeliverNotificationPayload } from "@waypoint/shared-types";
import { notifyIncident } from "@waypoint/jobs";
import { runWithTenant, tenantDb } from "@waypoint/db";

export { DELIVER_NOTIFICATION_JOB };

/**
 * Retry/async path for the same notifyIncident used on trigger + escalate.
 * Timing still lives in BullMQ; this is not a second copy of channel logic.
 */
export async function deliverNotification(
  job: Job<DeliverNotificationPayload>,
): Promise<void> {
  await runWithTenant(job.data.orgId, async () => {
    const incident = await tenantDb().incident.findFirst({
      where: { id: job.data.incidentId },
    });
    if (!incident) return;
    await notifyIncident({
      incidentId: incident.id,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      reason: job.data.reason,
      step: job.data.step,
      targetUserId: null,
      targetLabel: "retry",
    });
  });
}
