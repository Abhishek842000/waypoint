import { getTenantOrgId, tenantDb } from "@waypoint/db";
import type { IncidentEventType } from "@waypoint/shared-types";
import { publishOrgRealtime } from "./realtime";

export async function recordIncidentEvent(input: {
  incidentId: string;
  type: IncidentEventType;
  actorId?: string | null;
  payload: object;
}): Promise<{ id: string }> {
  const orgId = getTenantOrgId();
  const event = await tenantDb().incidentEvent.create({
    data: {
      orgId,
      incidentId: input.incidentId,
      type: input.type,
      actorId: input.actorId ?? null,
      payload: input.payload,
    },
  });

  const incident = await tenantDb().incident.findFirst({
    where: { id: input.incidentId },
    select: { id: true, status: true, serviceId: true },
  });

  await publishOrgRealtime({
    type: "incident.event",
    orgId,
    incidentId: input.incidentId,
    eventId: event.id,
    eventType: input.type,
    status: incident?.status ?? "triggered",
    serviceId: incident?.serviceId,
  });

  return { id: event.id };
}
