"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, type MeResponse } from "@/lib/api";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<MeResponse>("/v1/auth/me")
      .then(setMe)
      .catch(() => {
        setError("unauthenticated");
        router.replace("/login");
      });
  }, [router]);

  async function logout() {
    await api("/v1/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (error) return null;
  if (!me) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const links = [
    ["/incidents", "Incidents"],
    ["/services", "Services"],
    ["/settings", "Settings"],
  ] as const;

  return (
    <>
      <nav className="nav">
        <strong className="brand" style={{ margin: 0 }}>
          Waypoint
        </strong>
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            style={{ fontWeight: pathname.startsWith(href) ? 700 : 400 }}
          >
            {label}
          </Link>
        ))}
        {me.org && (
          <Link href={`/status/${me.org.slug}`} target="_blank" rel="noreferrer">
            Public status
          </Link>
        )}
        <span className="spacer" />
        <span className="org">
          {me.org?.name} · {me.role} · {me.user?.email}
        </span>
        <button className="secondary" onClick={logout} type="button">
          Log out
        </button>
      </nav>
      <div className="page">{children}</div>
    </>
  );
}
