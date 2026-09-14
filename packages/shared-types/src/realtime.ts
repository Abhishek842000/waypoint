import { z } from "zod";
import { IncidentEventTypeSchema, IncidentStatusSchema } from "./domain";

/**
 * Org-scoped dashboard events. Payload is a pointer, not a dump —
 * clients refetch the incident/timeline over the authenticated API.
 * Never include member names, emails, or notification payloads here.
 */
export const orgRealtimeEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("connected"),
    orgId: z.string(),
  }),
  z.object({
    type: z.literal("incident.event"),
    orgId: z.string(),
    incidentId: z.string(),
    eventId: z.string(),
    eventType: IncidentEventTypeSchema,
    status: IncidentStatusSchema,
    serviceId: z.string().optional(),
  }),
]);

export type OrgRealtimeEvent = z.infer<typeof orgRealtimeEventSchema>;
