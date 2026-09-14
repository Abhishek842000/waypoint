"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Member = {
  id: string;
  role: string;
  user: { id: string; email?: string; name?: string };
};

export default function SettingsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "viewer",
  });
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setMembers(await api<Member[]>("/v1/orgs/members"));
  }

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/v1/orgs/members", { method: "POST", body: JSON.stringify(form) });
      setForm({ email: "", name: "", password: "", role: "viewer" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="stack">
      <h1>Settings</h1>
      <p className="muted">
        Invite is password-based in Phase 0 (no email delivery). Use this to
        create a viewer and prove RBAC.
      </p>
      <form className="card stack" onSubmit={invite}>
        <strong>Invite member</strong>
        <label>
          Name
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label>
          Temporary password
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={8}
            required
          />
        </label>
        <label>
          Role
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="admin">admin</option>
            <option value="responder">responder</option>
            <option value="viewer">viewer</option>
          </select>
        </label>
        <button type="submit">Invite</button>
      </form>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>{m.user.name}</td>
              <td>{m.user.email}</td>
              <td>{m.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
