"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.replace("/incidents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={onSubmit}>
        <div className="brand">Waypoint</div>
        <h1>Sign in</h1>
        <p className="muted">Incident response for the org you belong to.</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <div style={{ height: 12 }} />
        <button type="submit">Sign in</button>
        {error && <p className="error">{error}</p>}
        <p className="muted" style={{ marginTop: "1rem" }}>
          No org yet? <Link href="/register">Create one</Link>
        </p>
      </form>
    </div>
  );
}
