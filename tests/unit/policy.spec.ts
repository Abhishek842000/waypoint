import { describe, expect, it } from "vitest";
import {
  isTerminalStep,
  nextStep,
  orderedSteps,
  resolveStepTarget,
  stepAt,
  validatePolicySteps,
  type PolicyStepLike,
} from "@waypoint/shared-types";

function step(partial: Partial<PolicyStepLike> & Pick<PolicyStepLike, "stepOrder" | "targetType">): PolicyStepLike {
  return {
    waitMinutes: 5,
    targetRotationId: null,
    targetUserId: null,
    ...partial,
  };
}

describe("escalation policy data model", () => {
  it("supports a single-step policy that is immediately terminal", () => {
    const steps = [
      step({
        stepOrder: 0,
        targetType: "user",
        targetUserId: "user-1",
        waitMinutes: 5,
      }),
    ];

    expect(orderedSteps(steps)).toHaveLength(1);
    expect(stepAt(steps, 0)?.targetUserId).toBe("user-1");
    expect(nextStep(steps, 0)).toBeNull();
    expect(isTerminalStep(steps, 0)).toBe(true);
    expect(validatePolicySteps(steps)).toEqual([]);
  });

  it("resolves a fixed-user target vs a rotation target using the current on-call", () => {
    const userStep = step({
      stepOrder: 0,
      targetType: "user",
      targetUserId: "fixed-oncall",
    });
    const rotationStep = step({
      stepOrder: 1,
      targetType: "rotation",
      targetRotationId: "rot-1",
    });

    expect(resolveStepTarget(userStep, "ignored-rotation-member")).toEqual({
      kind: "user",
      userId: "fixed-oncall",
    });
    expect(resolveStepTarget(rotationStep, "primary-oncall")).toEqual({
      kind: "rotation",
      rotationId: "rot-1",
      userId: "primary-oncall",
    });
  });

  it("marks the last step as terminal even when waitMinutes is set", () => {
    const steps = [
      step({
        stepOrder: 0,
        targetType: "rotation",
        targetRotationId: "rot-1",
        waitMinutes: 5,
      }),
      step({
        stepOrder: 1,
        targetType: "user",
        targetUserId: "secondary",
        waitMinutes: 5,
      }),
    ];

    expect(nextStep(steps, 0)?.targetUserId).toBe("secondary");
    expect(isTerminalStep(steps, 0)).toBe(false);
    expect(nextStep(steps, 1)).toBeNull();
    expect(isTerminalStep(steps, 1)).toBe(true);
    expect(validatePolicySteps(steps)).toEqual([]);
  });

  it("rejects mixed or missing targets", () => {
    const issues = validatePolicySteps([
      step({ stepOrder: 0, targetType: "user" }),
      step({
        stepOrder: 1,
        targetType: "rotation",
        targetRotationId: "rot-1",
        targetUserId: "oops",
      }),
    ]);
    expect(issues.map((i) => i.message)).toEqual(
      expect.arrayContaining([
        "user target requires targetUserId",
        "rotation target must not set targetUserId",
      ]),
    );
  });
});
