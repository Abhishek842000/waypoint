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

export const escalationTargetTypes = ["rotation", "user"] as const;
export const EscalationTargetTypeSchema = z.enum(escalationTargetTypes);
export type EscalationTargetType = z.infer<typeof EscalationTargetTypeSchema>;

export const notificationChannelTypes = ["slack", "sms", "email"] as const;
export const NotificationChannelTypeSchema = z.enum(notificationChannelTypes);
export type NotificationChannelType = z.infer<typeof NotificationChannelTypeSchema>;
