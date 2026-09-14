import { getTenantOrgId } from "@waypoint/db";
import type { NotificationDeliveryResult } from "@waypoint/shared-types";
import { recordIncidentEvent } from "./events";
import { pageIncidentStep, scheduleNextEscalation, type PagedTarget } from "./page-incident";

/**
 * Called once from IncidentsService.create after the row exists.
 * Writes the triggered event (with paging + delivery results), fires
 * channels, and enqueues the next BullMQ escalate job.
 */
export async function onIncidentOpened(input: {
  incidentId: string;
  title: string;
  severity: string;
  escalationPolicyId: string | null;
  actorId?: string | null;
}): Promise<{ target: PagedTarget; notifications: NotificationDeliveryResult[] }> {
  const paged = await pageIncidentStep({
    incidentId: input.incidentId,
    title: input.title,
    severity: input.severity,
    status: "triggered",
    escalationPolicyId: input.escalationPolicyId,
    stepIndex: 0,
    reason: "triggered",
    actorId: input.actorId,
  });

  await recordIncidentEvent({
    incidentId: input.incidentId,
    type: "triggered",
    actorId: input.actorId,
    payload: {
      title: input.title,
      severity: input.severity,
      step: 0,
      target: paged.target.resolved,
      targetLabel: paged.target.label,
      notifications: paged.notifications,
    },
  });

  await scheduleNextEscalation({
    incidentId: input.incidentId,
    orgId: getTenantOrgId(),
    escalationPolicyId: input.escalationPolicyId,
    currentStep: 0,
  });

  return paged;
}
