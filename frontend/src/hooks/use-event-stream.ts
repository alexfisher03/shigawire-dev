"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getEventStreamUrl } from "@/lib/backend";
import { subscribeReconnectingEventSource } from "@/lib/event-source-reconnect";

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

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const reset = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      reset();
    });
  }, [sessionId, reset]);

  useEffect(() => {
    if (!sessionId) return;

    const url = getEventStreamUrl();
    return subscribeReconnectingEventSource(url, {
      onMessage: (ev) => {
        try {
          const n = JSON.parse(ev.data) as EventNotification;
          n.arrived_at = Date.now();
          if (n.session_id !== sessionIdRef.current) return;
          setEvents((prev) => [...prev, n]);
        } catch {
          /* ignore malformed */
        }
      },
    });
  }, [sessionId]);

  const totalCount = events.length > 0 ? events[events.length - 1].total_count : 0;

  return { events, totalCount };
}
