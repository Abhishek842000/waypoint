"use client";

import { useEffect, useState } from "react";
import { api, type OrgMember, type Rotation } from "@/lib/api";

export default function RotationsPage() {
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [name, setName] = useState("Primary");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [r, m] = await Promise.all([
      api<Rotation[]>("/v1/rotations"),
      api<OrgMember[]>("/v1/orgs/members"),
    ]);
    setRotations(r);
    setMembers(m);
    if (!selected.length && m[0]) setSelected(m.map((x) => x.user.id));
  }

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(userId: string) {
    setSelected((cur) =>
      cur.includes(userId) ? cur.filter((id) => id !== userId) : [...cur, userId],
    );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/v1/rotations", {
        method: "POST",
        body: JSON.stringify({
          name,
          memberUserIds: selected,
          handoffIntervalDays: 7,
        }),
      });
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="stack">
      <h1>On-call rotations</h1>
      <p className="muted">
        Ordered roster with a weekly round-robin pointer. Calendar-based
        scheduling is a deliberate scope cut — the worker advances{" "}
        <code>currentPointer</code> via BullMQ, not a process timer.
      </p>
      <form className="card stack" onSubmit={create}>
        <strong>Create rotation</strong>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div>
          <div className="muted" style={{ marginBottom: 8 }}>
            Members (order = click order, currently {selected.length} selected)
          </div>
          {members.map((m) => (
            <label key={m.id} className="row" style={{ marginTop: 0 }}>
              <input
                type="checkbox"
                checked={selected.includes(m.user.id)}
                onChange={() => toggle(m.user.id)}
                style={{ width: "auto" }}
              />
              {m.user.name} ({m.user.email}) · {m.role}
              {selected.includes(m.user.id) ? ` · #${selected.indexOf(m.user.id) + 1}` : ""}
            </label>
          ))}
        </div>
        <button type="submit" disabled={selected.length < 1}>
          Save rotation
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {rotations.map((r) => (
        <div className="card stack" key={r.id}>
          <strong>{r.name}</strong>
          <div>
            On call now:{" "}
            <span className="badge operational">
              {r.currentlyOnCall?.user.name ?? "nobody"}
            </span>{" "}
            <span className="muted">
              pointer {r.currentPointer} · handoff every {r.handoffIntervalDays}d
            </span>
          </div>
          <ol>
            {r.members.map((m) => (
              <li key={m.id}>
                {m.user.name} ({m.user.email})
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
