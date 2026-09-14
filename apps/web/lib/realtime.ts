"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL } from "./api";
import type { OrgRealtimeEvent } from "@waypoint/shared-types";

/**
 * Org-scoped SSE. The API binds the stream to the session's orgId — this
 * hook never sends an org id of its own.
 */
export function useIncidentRealtime(onEvent: (event: OrgRealtimeEvent) => void) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const source = new EventSource(`${API_URL}/v1/realtime/incidents`, {
      withCredentials: true,
    });

    const handle = (raw: Event) => {
      const message = raw as MessageEvent<string>;
      if (!message.data) return;
      try {
        const data = JSON.parse(message.data) as OrgRealtimeEvent;
        if (data.type === "connected") {
          setConnected(true);
          return;
        }
        onEventRef.current(data);
      } catch {
        /* ignore keep-alives */
      }
    };

    source.addEventListener("open", () => setConnected(true));
    source.addEventListener("error", () => setConnected(false));
    source.addEventListener("message", handle);
    source.addEventListener("connected", handle);
    source.addEventListener("incident.event", handle);

    return () => {
      source.removeEventListener("message", handle);
      source.removeEventListener("connected", handle);
      source.removeEventListener("incident.event", handle);
      source.close();
      setConnected(false);
    };
  }, []);

  return { connected };
}
