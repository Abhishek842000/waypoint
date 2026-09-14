import { getTenantOrgId, tenantDb } from "@waypoint/db";
import type { IncidentEventType } from "@waypoint/shared-types";

export async function recordIncidentEvent(input: {
  incidentId: string;
  type: IncidentEventType;
  actorId?: string | null;
  payload: object;
}): Promise<{ id: string }> {
  const event = await tenantDb().incidentEvent.create({
    data: {
      orgId: getTenantOrgId(),
      incidentId: input.incidentId,
      type: input.type,
      actorId: input.actorId ?? null,
      payload: input.payload,
    },
  });
  return { id: event.id };
}
