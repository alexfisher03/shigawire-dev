"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getEventStreamUrl } from "@/lib/backend";

export interface EventNotification {
  session_id: string;
  event_id: string;
  method: string;
  url: string;
  status: number;
  total_count: number;
  arrived_at: number;
}

export function useEventStream(sessionId: string | null): {
  events: EventNotification[];
  totalCount: number;
} {
  const [events, setEvents] = useState<EventNotification[]>([]);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const reset = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    reset();
  }, [sessionId, reset]);

  useEffect(() => {
    if (!sessionId) return;

    const url = getEventStreamUrl();
    const es = new EventSource(url);

    es.onmessage = (ev) => {
      try {
        const n = JSON.parse(ev.data) as EventNotification;
        n.arrived_at = Date.now();
        if (n.session_id !== sessionIdRef.current) return;
        setEvents((prev) => [...prev, n]);
      } catch {
        /* ignore malformed */
      }
    };

    return () => es.close();
  }, [sessionId]);

  const totalCount = events.length > 0 ? events[events.length - 1].total_count : 0;

  return { events, totalCount };
}
