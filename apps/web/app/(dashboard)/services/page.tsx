"use client";

import { useEffect, useState } from "react";
import { api, type Service } from "@/lib/api";

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setServices(await api<Service[]>("/v1/services"));
  }

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/v1/services", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="stack">
      <h1>Services</h1>
      <form className="card row" onSubmit={create}>
        <input
          placeholder="Payments API"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit">Add service</button>
      </form>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>
                <span className={`badge ${s.currentStatus}`}>
                  {s.currentStatus.replace("_", " ")}
                </span>
              </td>
            </tr>
          ))}
          {!services.length && (
            <tr>
              <td colSpan={2} className="muted">
                No services yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
