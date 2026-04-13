"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGlobalRecordingStatus, type RecordingStatus } from "@/lib/api";
import { getRecordingStreamUrl } from "@/lib/backend";
import { subscribeReconnectingEventSource } from "@/lib/event-source-reconnect";

function parseRecordingStatus(data: unknown): RecordingStatus | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  return {
    recording: Boolean(o.recording),
    project_id: typeof o.project_id === "string" ? o.project_id : "",
    session_id: typeof o.session_id === "string" ? o.session_id : "",
  };
}

export function useRecordingStatusStream(): {
  status: RecordingStatus | null;
  refresh: () => Promise<void>;
} {
  const [status, setStatus] = useState<RecordingStatus | null>(null);
  const lastErrRefetchRef = useRef(0);

  const refresh = useCallback(async () => {
    const s = await getGlobalRecordingStatus();
    if (s) setStatus(s);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });

    const url = getRecordingStreamUrl();
    return subscribeReconnectingEventSource(url, {
      onOpen: () => void refresh(),
      onMessage: (ev) => {
        try {
          setStatus(parseRecordingStatus(JSON.parse(ev.data)));
        } catch {
          /* keep last known status */
        }
      },
      onConnectionLost: () => {
        const now = Date.now();
        if (now - lastErrRefetchRef.current < 2000) return;
        lastErrRefetchRef.current = now;
        void refresh();
      },
    });
  }, [refresh]);

  return { status, refresh };
}
