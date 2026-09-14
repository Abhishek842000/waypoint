import { describe, expect, it } from "vitest";
import {
  currentlyOnCall,
  isHandoffDue,
  nextPointer,
  orderedMembers,
} from "@waypoint/shared-types";

describe("rotation pointer", () => {
  const members = [
    { userId: "c", position: 2 },
    { userId: "a", position: 0 },
    { userId: "b", position: 1 },
  ];

  it("orders members by position, not insert order", () => {
    expect(orderedMembers(members).map((m) => m.userId)).toEqual(["a", "b", "c"]);
  });

  it("resolves who is currently on call from the pointer", () => {
    expect(currentlyOnCall(members, 0)?.userId).toBe("a");
    expect(currentlyOnCall(members, 1)?.userId).toBe("b");
    expect(currentlyOnCall(members, 2)?.userId).toBe("c");
  });

  it("wraps the pointer around the roster", () => {
    expect(nextPointer(0, 3)).toBe(1);
    expect(nextPointer(2, 3)).toBe(0);
    expect(nextPointer(0, 0)).toBe(0);
    expect(currentlyOnCall([], 0)).toBeNull();
  });

  it("treats weekly handoff as due only after the interval elapses", () => {
    const last = new Date("2026-09-01T00:00:00.000Z");
    expect(isHandoffDue(last, 7, new Date("2026-09-07T00:00:00.000Z"))).toBe(false);
    expect(isHandoffDue(last, 7, new Date("2026-09-08T00:00:00.000Z"))).toBe(true);
  });
});
