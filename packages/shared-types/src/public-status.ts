import { z } from "zod";
import {
  IncidentSeveritySchema,
  IncidentStatusSchema,
  ServiceStatusSchema,
  type IncidentSeverity,
  type IncidentStatus,
  type ServiceStatus,
} from "./domain";

/** Only these keys may appear on the unauthenticated status payload. */
export const PUBLIC_STATUS_ROOT_KEYS = [
  "org",
  "services",
  "incidents",
  "generatedAt",
] as const;

export const PUBLIC_STATUS_ORG_KEYS = ["name", "slug"] as const;
export const PUBLIC_STATUS_SERVICE_KEYS = ["id", "name", "currentStatus"] as const;
export const PUBLIC_STATUS_INCIDENT_KEYS = [
  "id",
  "title",
  "status",
  "severity",
  "createdAt",
  "resolvedAt",
] as const;

export const publicStatusOrgSchema = z.object({
  name: z.string(),
  slug: z.string(),
});

export const publicStatusServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  currentStatus: ServiceStatusSchema,
});

export const publicStatusIncidentSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: IncidentStatusSchema,
  severity: IncidentSeveritySchema,
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
});

export const publicStatusPayloadSchema = z.object({
  org: publicStatusOrgSchema,
  services: z.array(publicStatusServiceSchema),
  incidents: z.array(publicStatusIncidentSchema),
  generatedAt: z.string(),
});

export type PublicStatusPayload = z.infer<typeof publicStatusPayloadSchema>;

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * Explicit allow-list mapper. Extra fields on the source (emails, actor ids,
 * notification payloads, org internals) are dropped, never forwarded.
 */
export function toPublicStatusPayload(input: {
  org: { name: string; slug: string };
  services: Array<{ id: string; name: string; currentStatus: ServiceStatus }>;
  incidents: Array<{
    id: string;
    title: string;
    status: IncidentStatus;
    severity: IncidentSeverity;
    createdAt: Date | string;
    resolvedAt?: Date | string | null;
  }>;
  generatedAt?: Date | string;
}): PublicStatusPayload {
  return publicStatusPayloadSchema.parse({
    org: { name: input.org.name, slug: input.org.slug },
    services: input.services.map((service) => ({
      id: service.id,
      name: service.name,
      currentStatus: service.currentStatus,
    })),
    incidents: input.incidents.map((incident) => ({
      id: incident.id,
      title: incident.title,
      status: incident.status,
      severity: incident.severity,
      createdAt: iso(incident.createdAt) ?? "",
      resolvedAt: iso(incident.resolvedAt ?? null),
    })),
    generatedAt: iso(input.generatedAt ?? new Date()) ?? new Date().toISOString(),
  });
}
