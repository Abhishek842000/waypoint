"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const PUBLIC_STATUS_REFRESH_MS = 10_000;

/** Pull a fresh RSC payload so ISR + on-demand revalidate show up without a full reload. */
export function PublicStatusRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), PUBLIC_STATUS_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [router]);
  return (
    <p className="muted" style={{ fontSize: "0.8rem" }}>
      Refreshes about every 10 seconds. No login required.
    </p>
  );
}
