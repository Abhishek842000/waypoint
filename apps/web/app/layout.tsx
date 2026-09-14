import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Waypoint",
  description: "Incident response and public status pages",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
