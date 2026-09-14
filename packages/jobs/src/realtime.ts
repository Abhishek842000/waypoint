import { EventEmitter } from "node:events";
import type { OrgRealtimeEvent } from "@waypoint/shared-types";
import { getRedis } from "./queues";

const CHANNEL = "waypoint:org-realtime";
const processId = `${process.pid}:${Math.random().toString(36).slice(2)}`;

type Envelope = { origin: string; event: OrgRealtimeEvent };

const local = new EventEmitter();
local.setMaxListeners(0);

let pub: ReturnType<typeof getRedis> | null = null;
let sub: ReturnType<typeof getRedis> | null = null;
let subscribed = false;

function useRedisRealtime(): boolean {
  return process.env.WAYPOINT_JOBS !== "memory";
}

function orgKey(orgId: string): string {
  return `org:${orgId}`;
}

/**
 * Subscribe to one org's dashboard events. The listener must not be used
 * to fan out another org's traffic — callers pass actor.orgId only.
 */
export function subscribeOrgRealtime(
  orgId: string,
  listener: (event: OrgRealtimeEvent) => void,
): () => void {
  const key = orgKey(orgId);
  local.on(key, listener);
  return () => {
    local.off(key, listener);
  };
}

export async function publishOrgRealtime(event: OrgRealtimeEvent): Promise<void> {
  local.emit(orgKey(event.orgId), event);
  if (!useRedisRealtime()) return;
  try {
    if (!pub) pub = getRedis().duplicate();
    await pub.publish(CHANNEL, JSON.stringify({ origin: processId, event } satisfies Envelope));
  } catch (err) {
    console.error("[realtime] redis publish failed", err);
  }
}

/** API process: receive worker-published events without duplicating our own. */
export async function startRealtimeSubscriber(): Promise<void> {
  if (!useRedisRealtime() || subscribed) return;
  sub = getRedis().duplicate();
  sub.on("message", (_channel, message) => {
    try {
      const envelope = JSON.parse(message) as Envelope;
      if (envelope.origin === processId) return;
      local.emit(orgKey(envelope.event.orgId), envelope.event);
    } catch {
      /* ignore malformed */
    }
  });
  await sub.subscribe(CHANNEL);
  subscribed = true;
}

export async function stopRealtimeSubscriber(): Promise<void> {
  subscribed = false;
  await sub?.unsubscribe(CHANNEL).catch(() => undefined);
  await sub?.quit().catch(() => undefined);
  await pub?.quit().catch(() => undefined);
  sub = null;
  pub = null;
}

export function resetRealtimeBus(): void {
  local.removeAllListeners();
}
