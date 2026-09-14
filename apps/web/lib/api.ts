export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type MeResponse = {
  user: { id: string; email: string; name: string } | null;
  org: { id: string; name: string; slug: string } | null;
  role: "admin" | "responder" | "viewer" | null;
};

export type Service = {
  id: string;
  name: string;
  currentStatus: "operational" | "degraded" | "partial_outage" | "major_outage";
};

export type Rotation = {
  id: string;
  name: string;
  currentPointer: number;
  handoffIntervalDays: number;
  lastHandoffAt: string;
  members: Array<{
    id: string;
    userId: string;
    position: number;
    user: { id: string; name?: string; email?: string };
  }>;
  currentlyOnCall: { userId: string; user: { name?: string; email?: string } } | null;
};

export type EscalationPolicy = {
  id: string;
  name: string;
  steps: Array<{
    id: string;
    stepOrder: number;
    waitMinutes: number;
    targetType: "rotation" | "user";
    targetRotationId: string | null;
    targetUserId: string | null;
    isTerminal: boolean;
    resolvedTarget: { kind: string; userId?: string | null };
  }>;
};

export type OrgMember = {
  id: string;
  role: string;
  user: { id: string; email?: string; name?: string };
};

export type Incident = {
  id: string;
  title: string;
  status: "triggered" | "acknowledged" | "resolved";
  severity: "critical" | "high" | "medium" | "low";
  serviceId: string;
  createdAt: string;
  events: Array<{
    id: string;
    type: string;
    createdAt: string;
    payload: unknown;
  }>;
};
