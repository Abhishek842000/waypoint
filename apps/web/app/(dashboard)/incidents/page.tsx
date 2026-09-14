"use client";

import { useEffect, useState } from "react";
import { api, type Incident, type Service } from "@/lib/api";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [title, setTitle] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [severity, setSeverity] = useState("high");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [i, s] = await Promise.all([
      api<Incident[]>("/v1/incidents"),
      api<Service[]>("/v1/services"),
    ]);
    setIncidents(i);
    setServices(s);
    if (!serviceId && s[0]) setServiceId(s[0].id);
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
        body: JSON.stringify({ serviceId, title, severity }),
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
        <button type="submit" disabled={!serviceId}>
          Create incident
        </button>
        {!services.length && (
          <p className="muted">Create a service first under Services.</p>
        )}
      </form>
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
              <td>{i.title}</td>
              <td>
                <span className={`badge ${i.status}`}>{i.status}</span>
              </td>
              <td>
                <span className={`badge ${i.severity}`}>{i.severity}</span>
              </td>
              <td className="row">
                {i.status === "triggered" && (
                  <button type="button" className="secondary" onClick={() => act(i.id, "acknowledge")}>
                    Ack
                  </button>
                )}
                {i.status !== "resolved" && (
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
