import type { IncidentStatus } from "./domain";

/**
 * Legal incident transitions. Status is never a free-form PATCH —
 * only these edges are allowed, and only through guarded methods.
 *
 *   triggered → acknowledged → resolved
 *   triggered → resolved        (ack is implied)
 */
export const incidentTransitions: Record<IncidentStatus, readonly IncidentStatus[]> = {
  triggered: ["acknowledged", "resolved"],
  acknowledged: ["resolved"],
  resolved: [],
};

export class IllegalIncidentTransitionError extends Error {
  readonly from: IncidentStatus;
  readonly to: IncidentStatus;

  constructor(from: IncidentStatus, to: IncidentStatus) {
    super(
      from === "resolved" && to === "acknowledged"
        ? "Resolved incidents cannot be acknowledged"
        : from === to
          ? `Incident is already ${from}`
          : `Illegal incident transition: ${from} → ${to}`,
    );
    this.name = "IllegalIncidentTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return incidentTransitions[from].includes(to);
}

export function assertIncidentTransition(from: IncidentStatus, to: IncidentStatus): void {
  if (!canTransition(from, to)) {
    throw new IllegalIncidentTransitionError(from, to);
  }
}

export function escalationJobId(incidentId: string, step: number): string {
  return `escalate:${incidentId}:${step}`;
}

/**
 * Demo/CI shortcut: 5 policy minutes * (10 / 300) = 10 seconds.
 * Production leaves this unset (multiplier 1). Read at call time so tests
 * can change it without re-importing the module.
 */
export function escalationDelayMultiplier(): number {
  const raw = process.env.ESCALATION_DELAY_MULTIPLIER;
  if (raw === undefined || raw === "") return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 1;
  return n;
}

export function waitMinutesToDelayMs(waitMinutes: number): number {
  return Math.round(Math.max(0, waitMinutes) * 60_000 * escalationDelayMultiplier());
}
