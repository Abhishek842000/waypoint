import type { Job } from "bullmq";
import { ESCALATE_INCIDENT_JOB } from "@waypoint/shared-types";

export { ESCALATE_INCIDENT_JOB };

export type EscalateIncidentPayload = {
  incidentId: string;
  orgId: string;
  step: number;
};

/**
 * Phase 1 will implement the actual escalation state machine here.
 * Phase 0 registers the processor so the worker boots against Redis
 * and the job name is stable. Timing MUST stay in BullMQ — never setTimeout.
 */
export async function escalateIncident(job: Job<EscalateIncidentPayload>): Promise<void> {
  console.log(
    `[worker] escalate-incident received job ${job.id} incident=${job.data.incidentId} step=${job.data.step}`,
  );
}
