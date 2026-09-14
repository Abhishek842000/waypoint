import { getTenantOrgId, tenantDb, unscopedDb } from "@waypoint/db";
import {
  currentlyOnCall,
  nextStep,
  orderedSteps,
  resolveStepTarget,
  stepAt,
  type NotificationDeliveryResult,
  type ResolvedTarget,
} from "@waypoint/shared-types";
import { recordIncidentEvent } from "./events";
import { notifyIncident, type IncidentNotifyContext } from "./notify";
import { scheduleEscalationStep } from "./schedule";

export type PagedTarget = {
  step: number;
  resolved: ResolvedTarget | { kind: "none" } | { kind: "invalid"; reason: string };
  userId: string | null;
  label: string;
};

async function policySteps(escalationPolicyId: string | null) {
  if (!escalationPolicyId) return [];
  const policy = await tenantDb().escalationPolicy.findFirst({
    where: { id: escalationPolicyId },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  return policy ? orderedSteps(policy.steps) : [];
}

async function rotationOnCall(rotationId: string): Promise<string | null> {
  const rotation = await tenantDb().rotation.findFirst({
    where: { id: rotationId },
    include: { members: { orderBy: { position: "asc" } } },
  });
  if (!rotation) return null;
  return currentlyOnCall(rotation.members, rotation.currentPointer)?.userId ?? null;
}

async function userLabel(userId: string | null): Promise<string> {
  if (!userId) return "unresolved target";
  const user = await unscopedDb().user.findFirst({ where: { id: userId } });
  if (!user) return userId;
  return `${user.name} <${user.email}>`;
}

export async function resolvePagedTarget(
  escalationPolicyId: string | null,
  stepIndex: number,
): Promise<PagedTarget> {
  const steps = await policySteps(escalationPolicyId);
  const step = stepAt(steps, stepIndex);
  if (!step) {
    return { step: stepIndex, resolved: { kind: "none" }, userId: null, label: "no policy step" };
  }
  const onCall =
    step.targetType === "rotation" && step.targetRotationId
      ? await rotationOnCall(step.targetRotationId)
      : null;
  const resolved = resolveStepTarget(step, onCall);
  const userId = resolved.kind === "invalid" ? null : resolved.userId;
  return {
    step: stepIndex,
    resolved,
    userId,
    label: await userLabel(userId),
  };
}

async function targetEmail(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const user = await unscopedDb().user.findFirst({ where: { id: userId } });
  return user?.email ?? null;
}

/**
 * Page the policy step: resolve the on-call/user target, fire every enabled
 * org channel, and (for escalations) persist the event. Trigger and escalate
 * both call this so notification + target resolution stay in one place.
 */
export async function pageIncidentStep(input: {
  incidentId: string;
  title: string;
  severity: string;
  status: string;
  escalationPolicyId: string | null;
  stepIndex: number;
  reason: "triggered" | "escalated";
  actorId?: string | null;
}): Promise<{ target: PagedTarget; notifications: NotificationDeliveryResult[] }> {
  const target = await resolvePagedTarget(input.escalationPolicyId, input.stepIndex);
  const ctx: IncidentNotifyContext = {
    incidentId: input.incidentId,
    title: input.title,
    severity: input.severity,
    status: input.status,
    reason: input.reason,
    step: input.stepIndex,
    targetUserId: target.userId,
    targetLabel: target.label,
  };
  const notifications = await notifyIncident(ctx, await targetEmail(target.userId));

  if (input.reason === "escalated") {
    await recordIncidentEvent({
      incidentId: input.incidentId,
      type: "escalated",
      actorId: input.actorId,
      payload: {
        step: input.stepIndex,
        target: target.resolved,
        targetLabel: target.label,
        notifications,
      },
    });
  }

  return { target, notifications };
}

export async function scheduleNextEscalation(input: {
  incidentId: string;
  orgId?: string;
  escalationPolicyId: string | null;
  currentStep: number;
}): Promise<void> {
  const steps = await policySteps(input.escalationPolicyId);
  const nxt = nextStep(steps, input.currentStep);
  if (!nxt) return;
  const current = stepAt(steps, input.currentStep);
  await scheduleEscalationStep(
    {
      incidentId: input.incidentId,
      orgId: input.orgId ?? getTenantOrgId(),
      step: nxt.stepOrder,
    },
    current?.waitMinutes ?? 0,
  );
}
