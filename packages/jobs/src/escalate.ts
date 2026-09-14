import { runWithTenant, tenantDb } from "@waypoint/db";
import type { EscalateIncidentPayload } from "@waypoint/shared-types";
import { pageIncidentStep, scheduleNextEscalation } from "./page-incident";

/**
 * BullMQ processor body. Also invoked by the test fake clock.
 * No-ops if the incident was acked/resolved before the delay elapsed.
 */
export async function applyEscalationStep(
  payload: EscalateIncidentPayload,
): Promise<{ skipped?: string } | { escalated: true; step: number }> {
  return runWithTenant(payload.orgId, async () => {
    const incident = await tenantDb().incident.findFirst({
      where: { id: payload.incidentId },
    });
    if (!incident) return { skipped: "missing" };
    if (incident.status !== "triggered") {
      return { skipped: `status:${incident.status}` };
    }
    if (payload.step <= incident.currentEscalationStep) {
      return { skipped: "already-at-or-past-step" };
    }

    await tenantDb().incident.update({
      where: { id: incident.id },
      data: { currentEscalationStep: payload.step },
    });

    await pageIncidentStep({
      incidentId: incident.id,
      title: incident.title,
      severity: incident.severity,
      status: "triggered",
      escalationPolicyId: incident.escalationPolicyId,
      stepIndex: payload.step,
      reason: "escalated",
    });

    await scheduleNextEscalation({
      incidentId: incident.id,
      orgId: payload.orgId,
      escalationPolicyId: incident.escalationPolicyId,
      currentStep: payload.step,
    });

    return { escalated: true, step: payload.step };
  });
}
