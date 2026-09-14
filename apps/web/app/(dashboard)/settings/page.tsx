"use client";

import { useEffect, useState } from "react";
import {
  api,
  type ApiKey,
  type MeResponse,
  type NotificationChannel,
} from "@/lib/api";

type Member = {
  id: string;
  role: string;
  user: { id: string; email?: string; name?: string };
};

export default function SettingsPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "viewer",
  });
  const [slackUrl, setSlackUrl] = useState("");
  const [smsTo, setSmsTo] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isAdmin = me?.role === "admin";

  async function refresh() {
    const who = await api<MeResponse>("/v1/auth/me");
    setMe(who);
    setMembers(await api<Member[]>("/v1/orgs/members"));
    if (who.role === "admin") {
      const [ch, k] = await Promise.all([
        api<NotificationChannel[]>("/v1/notification-channels"),
        api<ApiKey[]>("/v1/api-keys"),
      ]);
      setChannels(ch);
      setKeys(k);
    }
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

  async function addChannel(type: NotificationChannel["type"], config: Record<string, unknown>) {
    setError(null);
    try {
      await api("/v1/notification-channels", {
        method: "POST",
        body: JSON.stringify({ name: `${type} channel`, type, config }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function mintKey(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await api<ApiKey>("/v1/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: "monitor",
          scopes: ["incident:create", "incident:read"],
        }),
      });
      setPlaintext(created.plaintext ?? null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="stack">
      <h1>Settings</h1>
      <p className="muted">
        Invite is password-based (no email). Create a viewer to prove RBAC: they
        can read incidents but get 403 on acknowledge.
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

      {isAdmin && (
        <>
          <div className="card stack">
            <strong>Notification channels</strong>
            <p className="muted" style={{ margin: 0 }}>
              Slack incoming webhook is the proven path. SMS (Twilio) and email
              (Resend) use the same dispatcher once env credentials are set.
            </p>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                void addChannel("slack", { webhookUrl: slackUrl }).then(() => setSlackUrl(""));
              }}
            >
              <label>
                Slack webhook URL
                <input
                  value={slackUrl}
                  onChange={(e) => setSlackUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/…"
                  required
                />
              </label>
              <button type="submit">Add Slack</button>
            </form>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                void addChannel("sms", { to: smsTo }).then(() => setSmsTo(""));
              }}
            >
              <input
                value={smsTo}
                onChange={(e) => setSmsTo(e.target.value)}
                placeholder="+15555550100"
                required
              />
              <button type="submit" className="secondary">
                Add SMS
              </button>
            </form>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                void addChannel("email", { to: emailTo }).then(() => setEmailTo(""));
              }}
            >
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="oncall@acme.test"
                required
              />
              <button type="submit" className="secondary">
                Add email
              </button>
            </form>
            <ul>
              {channels.map((c) => (
                <li key={c.id}>
                  {c.type} · {c.name} {c.enabled ? "" : "(disabled)"}
                </li>
              ))}
              {!channels.length && <li className="muted">No channels yet.</li>}
            </ul>
          </div>

          <form className="card stack" onSubmit={mintKey}>
            <strong>API keys</strong>
            <p className="muted" style={{ margin: 0 }}>
              Mint a key with incident:create + incident:read to trigger from curl.
            </p>
            <button type="submit">Create monitor key</button>
            {plaintext && (
              <p>
                Copy now — it will not be shown again: <code>{plaintext}</code>
              </p>
            )}
            <ul>
              {keys.map((k) => (
                <li key={k.id}>
                  {k.name} · {k.prefix}… · {k.scopes.join(", ")}
                </li>
              ))}
            </ul>
          </form>
        </>
      )}
    </div>
  );
}
