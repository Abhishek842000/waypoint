import type { Job } from "bullmq";
import { ESCALATE_INCIDENT_JOB, type EscalateIncidentPayload } from "@waypoint/shared-types";
import { applyEscalationStep } from "@waypoint/jobs";

export { ESCALATE_INCIDENT_JOB };

export async function escalateIncident(job: Job<EscalateIncidentPayload>): Promise<void> {
  const result = await applyEscalationStep(job.data);
  if ("skipped" in result && result.skipped) {
    console.log(
      `[worker] escalate-incident skipped job ${job.id} incident=${job.data.incidentId} reason=${result.skipped}`,
    );
    return;
  }
  console.log(
    `[worker] escalate-incident paged step ${job.data.step} incident=${job.data.incidentId}`,
  );
}
