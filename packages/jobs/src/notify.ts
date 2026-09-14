import {
  emailChannelConfigSchema,
  slackChannelConfigSchema,
  smsChannelConfigSchema,
  type NotificationChannelKind,
  type NotificationDeliveryResult,
} from "@waypoint/shared-types";
import { getTenantOrgId, tenantDb } from "@waypoint/db";

export type IncidentNotifyContext = {
  incidentId: string;
  title: string;
  severity: string;
  status: string;
  reason: "triggered" | "escalated";
  step: number;
  targetUserId: string | null;
  targetLabel: string;
};

export type NotificationHttp = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; body: string }>;

const captured: Array<{ url: string; body: string; headers: Record<string, string> }> = [];

export function capturedNotificationPosts() {
  return captured;
}

export function resetCapturedNotificationPosts() {
  captured.length = 0;
}

async function capturingHttp(
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
): Promise<{ ok: boolean; status: number; body: string }> {
  captured.push({ url, body: init.body, headers: init.headers });
  return { ok: true, status: 200, body: "ok" };
}

async function liveHttp(
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
): Promise<{ ok: boolean; status: number; body: string }> {
  captured.push({ url, body: init.body, headers: init.headers });
  const res = await fetch(url, init);
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

let http: NotificationHttp =
  process.env.NODE_ENV === "test" ? capturingHttp : liveHttp;

export function setNotificationHttp(next: NotificationHttp) {
  http = next;
}

export function resetNotificationHttp() {
  http = process.env.NODE_ENV === "test" ? capturingHttp : liveHttp;
}

function slackText(ctx: IncidentNotifyContext): string {
  return [
    `*[Waypoint]* ${ctx.reason === "triggered" ? "Incident triggered" : "Incident escalated"}`,
    `*${ctx.title}* (${ctx.severity})`,
    `Status: ${ctx.status} · step ${ctx.step}`,
    `Paging: ${ctx.targetLabel}`,
    `Incident: ${ctx.incidentId}`,
  ].join("\n");
}

async function deliverSlack(
  config: unknown,
  ctx: IncidentNotifyContext,
): Promise<Omit<NotificationDeliveryResult, "channelId">> {
  const parsed = slackChannelConfigSchema.safeParse(config);
  if (!parsed.success) {
    return { channel: "slack", status: "failed", detail: "invalid slack config" };
  }
  try {
    const res = await http(parsed.data.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: slackText(ctx) }),
    });
    if (!res.ok) {
      return { channel: "slack", status: "failed", detail: `HTTP ${res.status}` };
    }
    return { channel: "slack", status: "sent", detail: "ok" };
  } catch (err) {
    return {
      channel: "slack",
      status: "failed",
      detail: err instanceof Error ? err.message : "slack request failed",
    };
  }
}

async function deliverSms(
  config: unknown,
  ctx: IncidentNotifyContext,
): Promise<Omit<NotificationDeliveryResult, "channelId">> {
  const parsed = smsChannelConfigSchema.safeParse(config);
  if (!parsed.success) {
    return { channel: "sms", status: "failed", detail: "invalid sms config" };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    return {
      channel: "sms",
      status: "skipped",
      detail: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM not configured",
    };
  }
  const body = new URLSearchParams({
    To: parsed.data.to,
    From: from,
    Body: `Waypoint ${ctx.reason}: ${ctx.title} (${ctx.severity}). Paging ${ctx.targetLabel}.`,
  });
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  try {
    const res = await http(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );
    if (!res.ok) {
      return { channel: "sms", status: "failed", detail: `HTTP ${res.status}` };
    }
    return { channel: "sms", status: "sent", detail: parsed.data.to };
  } catch (err) {
    return {
      channel: "sms",
      status: "failed",
      detail: err instanceof Error ? err.message : "twilio request failed",
    };
  }
}

async function deliverEmail(
  config: unknown,
  ctx: IncidentNotifyContext,
  fallbackTo: string | null,
): Promise<Omit<NotificationDeliveryResult, "channelId">> {
  const parsed = emailChannelConfigSchema.safeParse(config);
  if (!parsed.success) {
    return { channel: "email", status: "failed", detail: "invalid email config" };
  }
  const to = parsed.data.to ?? fallbackTo;
  if (!to) {
    return {
      channel: "email",
      status: "skipped",
      detail: "no recipient (set config.to or page a user with an email)",
    };
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Waypoint <noreply@waypoint.local>";
  if (!apiKey) {
    return {
      channel: "email",
      status: "skipped",
      detail: "RESEND_API_KEY not configured",
    };
  }
  try {
    const res = await http("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `[${ctx.severity}] ${ctx.title}`,
        text: slackText(ctx),
      }),
    });
    if (!res.ok) {
      return { channel: "email", status: "failed", detail: `HTTP ${res.status}` };
    }
    return { channel: "email", status: "sent", detail: to };
  } catch (err) {
    return {
      channel: "email",
      status: "failed",
      detail: err instanceof Error ? err.message : "resend request failed",
    };
  }
}

export async function notifyIncident(
  ctx: IncidentNotifyContext,
  pagedUserEmail: string | null = null,
): Promise<NotificationDeliveryResult[]> {
  const channels = await tenantDb().notificationChannel.findMany({
    where: { orgId: getTenantOrgId(), enabled: true },
  });

  const results: NotificationDeliveryResult[] = [];
  for (const channel of channels) {
    const kind = channel.type as NotificationChannelKind;
    const base =
      kind === "slack"
        ? await deliverSlack(channel.config, ctx)
        : kind === "sms"
          ? await deliverSms(channel.config, ctx)
          : await deliverEmail(channel.config, ctx, pagedUserEmail);
    results.push({ channelId: channel.id, ...base });
  }
  return results;
}
