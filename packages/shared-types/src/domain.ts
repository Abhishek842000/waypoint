import { z } from "zod";

export const incidentStatuses = ["triggered", "acknowledged", "resolved"] as const;
export const IncidentStatusSchema = z.enum(incidentStatuses);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const incidentSeverities = ["critical", "high", "medium", "low"] as const;
export const IncidentSeveritySchema = z.enum(incidentSeverities);
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

export const incidentEventTypes = [
  "triggered",
  "acknowledged",
  "escalated",
  "comment",
  "resolved",
] as const;
export const IncidentEventTypeSchema = z.enum(incidentEventTypes);
export type IncidentEventType = z.infer<typeof IncidentEventTypeSchema>;

export const serviceStatuses = [
  "operational",
  "degraded",
  "partial_outage",
  "major_outage",
] as const;
export const ServiceStatusSchema = z.enum(serviceStatuses);
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

const serviceStatusRank: Record<ServiceStatus, number> = {
  operational: 0,
  degraded: 1,
  partial_outage: 2,
  major_outage: 3,
};

/** Map incident severity onto the public service status shown on /status/:slug. */
export function serviceStatusForSeverity(severity: IncidentSeverity): ServiceStatus {
  switch (severity) {
    case "critical":
      return "major_outage";
    case "high":
      return "partial_outage";
    case "medium":
    case "low":
      return "degraded";
  }
}

export function worstServiceStatus(statuses: readonly ServiceStatus[]): ServiceStatus {
  return statuses.reduce<ServiceStatus>(
    (worst, status) =>
      serviceStatusRank[status] > serviceStatusRank[worst] ? status : worst,
    "operational",
  );
}

export const escalationTargetTypes = ["rotation", "user"] as const;
export const EscalationTargetTypeSchema = z.enum(escalationTargetTypes);
export type EscalationTargetType = z.infer<typeof EscalationTargetTypeSchema>;

export const notificationChannelTypes = ["slack", "sms", "email"] as const;
export const NotificationChannelTypeSchema = z.enum(notificationChannelTypes);
export type NotificationChannelType = z.infer<typeof NotificationChannelTypeSchema>;
