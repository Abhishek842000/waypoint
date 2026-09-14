import type { ReactNode } from "react";

/**
 * Public status pages are structurally outside (dashboard). This layout
 * must never import the authenticated nav or session helpers.
 */
export default function PublicStatusLayout({ children }: { children: ReactNode }) {
  return children;
}
