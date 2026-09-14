import { describe, expect, it } from "vitest";
import {
  IllegalIncidentTransitionError,
  assertIncidentTransition,
  canTransition,
  incidentTransitions,
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
