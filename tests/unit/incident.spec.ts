import { afterEach, describe, expect, it } from "vitest";
import {
  IllegalIncidentTransitionError,
  assertIncidentTransition,
  canTransition,
  incidentTransitions,
  waitMinutesToDelayMs,
} from "@waypoint/shared-types";

describe("incident state machine", () => {
  it("allows triggered → acknowledged → resolved and triggered → resolved", () => {
    expect(incidentTransitions.triggered).toEqual(["acknowledged", "resolved"]);
    expect(canTransition("triggered", "acknowledged")).toBe(true);
    expect(canTransition("acknowledged", "resolved")).toBe(true);
    expect(canTransition("triggered", "resolved")).toBe(true);
    expect(() => assertIncidentTransition("triggered", "acknowledged")).not.toThrow();
  });

  it("rejects acknowledging a resolved incident", () => {
    expect(canTransition("resolved", "acknowledged")).toBe(false);
    expect(() => assertIncidentTransition("resolved", "acknowledged")).toThrow(
      IllegalIncidentTransitionError,
    );
    try {
      assertIncidentTransition("resolved", "acknowledged");
    } catch (err) {
      expect(err).toBeInstanceOf(IllegalIncidentTransitionError);
      expect((err as Error).message).toMatch(/cannot be acknowledged/i);
    }
  });

  it("rejects re-acknowledging an already-acknowledged incident", () => {
    expect(() => assertIncidentTransition("acknowledged", "acknowledged")).toThrow(
      /already acknowledged/i,
    );
  });
});

describe("escalation delay multiplier", () => {
  const previous = process.env.ESCALATION_DELAY_MULTIPLIER;

  afterEach(() => {
    if (previous === undefined) delete process.env.ESCALATION_DELAY_MULTIPLIER;
    else process.env.ESCALATION_DELAY_MULTIPLIER = previous;
  });

  it("defaults to real minutes", () => {
    delete process.env.ESCALATION_DELAY_MULTIPLIER;
    expect(waitMinutesToDelayMs(1)).toBe(60_000);
    expect(waitMinutesToDelayMs(5)).toBe(300_000);
  });

  it("shrinks 5 policy minutes to 10 seconds when the multiplier is 10/300", () => {
    process.env.ESCALATION_DELAY_MULTIPLIER = String(10 / (5 * 60));
    expect(waitMinutesToDelayMs(5)).toBe(10_000);
  });
});
