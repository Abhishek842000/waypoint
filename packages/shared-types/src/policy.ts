import type { EscalationTargetType } from "./domain";

export type PolicyStepLike = {
  stepOrder: number;
  waitMinutes: number;
  targetType: EscalationTargetType;
  targetRotationId: string | null;
  targetUserId: string | null;
};

export type ResolvedTarget =
  | { kind: "user"; userId: string }
  | { kind: "rotation"; rotationId: string; userId: string | null };

export function orderedSteps<T extends PolicyStepLike>(steps: T[]): T[] {
  return [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
}

export function stepAt<T extends PolicyStepLike>(steps: T[], index: number): T | null {
  return orderedSteps(steps)[index] ?? null;
}

/** Next step after `index`, or null when this is the terminal escalation. */
export function nextStep<T extends PolicyStepLike>(steps: T[], index: number): T | null {
  return orderedSteps(steps)[index + 1] ?? null;
}

export function isTerminalStep(steps: PolicyStepLike[], index: number): boolean {
  return nextStep(steps, index) === null && stepAt(steps, index) !== null;
}

export function resolveStepTarget(
  step: PolicyStepLike,
  rotationOnCallUserId: string | null,
): ResolvedTarget | { kind: "invalid"; reason: string } {
  if (step.targetType === "user") {
    if (!step.targetUserId) {
      return { kind: "invalid", reason: "user target is missing targetUserId" };
    }
    return { kind: "user", userId: step.targetUserId };
  }
  if (!step.targetRotationId) {
    return { kind: "invalid", reason: "rotation target is missing targetRotationId" };
  }
  return {
    kind: "rotation",
    rotationId: step.targetRotationId,
    userId: rotationOnCallUserId,
  };
}

export type StepIssue = { path: string; message: string };

export function validatePolicySteps(steps: PolicyStepLike[]): StepIssue[] {
  const issues: StepIssue[] = [];
  if (steps.length === 0) {
    issues.push({ path: "steps", message: "policy must have at least one step" });
    return issues;
  }

  const ordered = orderedSteps(steps);
  ordered.forEach((step, i) => {
    if (step.stepOrder !== i) {
      issues.push({
        path: `steps.${i}.stepOrder`,
        message: `stepOrder must be contiguous starting at 0 (got ${step.stepOrder} at index ${i})`,
      });
    }
    if (step.waitMinutes < 0) {
      issues.push({
        path: `steps.${i}.waitMinutes`,
        message: "waitMinutes cannot be negative",
      });
    }
    if (step.targetType === "user") {
      if (!step.targetUserId) {
        issues.push({
          path: `steps.${i}.targetUserId`,
          message: "user target requires targetUserId",
        });
      }
      if (step.targetRotationId) {
        issues.push({
          path: `steps.${i}.targetRotationId`,
          message: "user target must not set targetRotationId",
        });
      }
    }
    if (step.targetType === "rotation") {
      if (!step.targetRotationId) {
        issues.push({
          path: `steps.${i}.targetRotationId`,
          message: "rotation target requires targetRotationId",
        });
      }
      if (step.targetUserId) {
        issues.push({
          path: `steps.${i}.targetUserId`,
          message: "rotation target must not set targetUserId",
        });
      }
    }
  });
  return issues;
}
