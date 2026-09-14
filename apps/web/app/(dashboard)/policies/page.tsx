"use client";

import { useEffect, useState } from "react";
import { api, type EscalationPolicy, type OrgMember, type Rotation } from "@/lib/api";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<EscalationPolicy[]>([]);
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [name, setName] = useState("Page primary, then secondary");
  const [rotationId, setRotationId] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [p, r, m] = await Promise.all([
      api<EscalationPolicy[]>("/v1/escalation-policies"),
      api<Rotation[]>("/v1/rotations"),
      api<OrgMember[]>("/v1/orgs/members"),
    ]);
    setPolicies(p);
    setRotations(r);
    setMembers(m);
    if (!rotationId && r[0]) setRotationId(r[0].id);
    if (!userId && m[0]) setUserId(m[0].user.id);
  }

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/v1/escalation-policies", {
        method: "POST",
        body: JSON.stringify({
          name,
          steps: [
            { waitMinutes: 1, targetType: "rotation", targetRotationId: rotationId },
            { waitMinutes: 1, targetType: "user", targetUserId: userId },
          ],
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
      <h1>Escalation policies</h1>
      <p className="muted">
        Ordered steps. Step 0 is paged on trigger; <code>waitMinutes</code> is
        the BullMQ delay before the next step (not a process timer). Set{" "}
        <code>ESCALATION_DELAY_MULTIPLIER</code> (e.g. <code>10/300</code> so 5
        minutes become 10 seconds) to demo without waiting.
      </p>
      <form className="card stack" onSubmit={create}>
        <strong>Create 2-step policy</strong>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Step 0 — page rotation (wait 1 min)
          <select value={rotationId} onChange={(e) => setRotationId(e.target.value)}>
            {rotations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Step 1 — page user (terminal)
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.user.id}>
                {m.user.name} ({m.role})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={!rotationId || !userId}>
          Save policy
        </button>
        {!rotations.length && (
          <p className="muted">Create a rotation first.</p>
        )}
      </form>
      {error && <p className="error">{error}</p>}
      {policies.map((p) => (
        <div className="card stack" key={p.id}>
          <strong>{p.name}</strong>
          <ol>
            {p.steps.map((s) => {
              const rotationName = rotations.find((r) => r.id === s.targetRotationId)?.name;
              const userName =
                members.find((m) => m.user.id === (s.targetUserId ?? s.resolvedTarget.userId))
                  ?.user.name;
              return (
                <li key={s.id}>
                  Step {s.stepOrder}: {s.targetType === "rotation" ? `rotation “${rotationName}”` : `user ${userName}`}
                  {s.targetType === "rotation" && userName ? ` (on-call: ${userName})` : ""} · wait{" "}
                  {s.waitMinutes}m {s.isTerminal ? "· terminal" : ""}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
