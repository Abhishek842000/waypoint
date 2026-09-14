"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type EscalationPolicy, type Incident, type MeResponse, type Service } from "@/lib/api";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [policies, setPolicies] = useState<EscalationPolicy[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [title, setTitle] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [severity, setSeverity] = useState("high");
  const [error, setError] = useState<string | null>(null);
  const canAct = me?.role === "admin" || me?.role === "responder";
  const canCreate = canAct;

  async function refresh() {
    const [i, s, p, who] = await Promise.all([
      api<Incident[]>("/v1/incidents"),
      api<Service[]>("/v1/services"),
      api<EscalationPolicy[]>("/v1/escalation-policies"),
      api<MeResponse>("/v1/auth/me"),
    ]);
    setIncidents(i);
    setServices(s);
    setPolicies(p);
    setMe(who);
    if (!serviceId && s[0]) setServiceId(s[0].id);
    if (!policyId) {
      const fallback = s[0]?.escalationPolicyId ?? p[0]?.id ?? "";
      setPolicyId(fallback);
    }
  }

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createIncident(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/v1/incidents", {
        method: "POST",
        body: JSON.stringify({
          serviceId,
          title,
          severity,
          ...(policyId ? { escalationPolicyId: policyId } : {}),
        }),
      });
      setTitle("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function act(id: string, action: "acknowledge" | "resolve") {
    setError(null);
    try {
      await api(`/v1/incidents/${id}/${action}`, { method: "POST" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="stack">
      <h1>Incidents</h1>
      {canCreate && (
        <form className="card stack" onSubmit={createIncident}>
          <strong>Trigger incident</strong>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <div className="row">
            <label style={{ flex: 1 }}>
              Service
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Severity
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="critical">critical</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </label>
          </div>
          <label>
            Escalation policy
            <select value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
              <option value="">None (notify only, no escalate)</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={!serviceId}>
            Create incident
          </button>
          {!services.length && (
            <p className="muted">Create a service first under Services.</p>
          )}
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Severity</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((i) => (
            <tr key={i.id}>
              <td>
                <Link href={`/incidents/${i.id}`}>{i.title}</Link>
              </td>
              <td>
                <span className={`badge ${i.status}`}>{i.status}</span>
              </td>
              <td>
                <span className={`badge ${i.severity}`}>{i.severity}</span>
              </td>
              <td className="row">
                {canAct && i.status === "triggered" && (
                  <button type="button" className="secondary" onClick={() => act(i.id, "acknowledge")}>
                    Ack
                  </button>
                )}
                {canAct && i.status !== "resolved" && (
                  <button type="button" onClick={() => act(i.id, "resolve")}>
                    Resolve
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!incidents.length && (
            <tr>
              <td colSpan={4} className="muted">
                No incidents yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
