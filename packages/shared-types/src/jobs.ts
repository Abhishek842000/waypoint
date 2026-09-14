export const ESCALATE_INCIDENT_JOB = "escalate-incident";
export const DELIVER_NOTIFICATION_JOB = "deliver-notification";
export const ADVANCE_ROTATIONS_JOB = "advance-rotations";

export const notificationChannels = ["slack", "sms", "email"] as const;
export type NotificationChannelKind = (typeof notificationChannels)[number];

export type EscalateIncidentPayload = {
  incidentId: string;
  orgId: string;
  step: number;
};

export type DeliverNotificationPayload = {
  orgId: string;
  incidentId: string;
  reason: "triggered" | "escalated";
  step: number;
};

export type NotificationDeliveryResult = {
  channelId: string;
  channel: NotificationChannelKind;
  status: "sent" | "skipped" | "failed";
  detail: string;
};
