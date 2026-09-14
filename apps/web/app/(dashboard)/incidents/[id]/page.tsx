"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type Incident, type IncidentEvent, type MeResponse } from "@/lib/api";

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canAct = me?.role === "admin" || me?.role === "responder";

  async function refresh() {
    const [i, t, who] = await Promise.all([
      api<Incident>(`/v1/incidents/${params.id}`),
      api<IncidentEvent[]>(`/v1/incidents/${params.id}/timeline`),
      api<MeResponse>("/v1/auth/me"),
    ]);
    setIncident(i);
    setEvents(t);
    setMe(who);
  }

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function act(action: "acknowledge" | "resolve") {
    setError(null);
    try {
      await api(`/v1/incidents/${params.id}/${action}`, { method: "POST" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  if (!incident) {
    return (
      <div className="stack">
        <p className="muted">{error ?? "Loading…"}</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="muted">
        <Link href="/incidents">← Incidents</Link>
      </p>
      <div className="row">
        <h1 style={{ margin: 0 }}>{incident.title}</h1>
        <span className={`badge ${incident.status}`}>{incident.status}</span>
        <span className={`badge ${incident.severity}`}>{incident.severity}</span>
      </div>
      {canAct && (
        <div className="row">
          {incident.status === "triggered" && (
            <button type="button" className="secondary" onClick={() => act("acknowledge")}>
              Acknowledge
            </button>
          )}
          {incident.status !== "resolved" && (
            <button type="button" onClick={() => act("resolve")}>
              Resolve
            </button>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="card stack">
        <strong>Timeline</strong>
        <p className="muted" style={{ margin: 0 }}>
          Same ordered IncidentEvent log as GET /v1/incidents/:id/timeline — audit
          and UI share one source of truth.
        </p>
        <ol className="timeline">
          {events.map((event) => (
            <li key={event.id}>
              <div className="row">
                <span className={`badge ${event.type}`}>{event.type}</span>
                <span className="muted">{new Date(event.createdAt).toLocaleString()}</span>
              </div>
              <pre className="muted" style={{ whiteSpace: "pre-wrap", margin: "0.35rem 0 0" }}>
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
