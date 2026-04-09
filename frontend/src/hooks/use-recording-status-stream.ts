"use client";

import { useCallback, useEffect, useState } from "react";
import { getGlobalRecordingStatus, type RecordingStatus } from "@/lib/api";
import { getRecordingStreamUrl } from "@/lib/backend";

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

  const refresh = useCallback(async () => {
    const s = await getGlobalRecordingStatus();
    if (s) setStatus(s);
  }, []);

  useEffect(() => {
    void refresh();

    const url = getRecordingStreamUrl();
    const es = new EventSource(url);

    es.onopen = () => {
      void refresh();
    };

    es.onmessage = (ev) => {
      try {
        setStatus(parseRecordingStatus(JSON.parse(ev.data)));
      } catch {
        /* keep last known status */
      }
    };

    let lastErrRefetch = 0;
    es.onerror = () => {
      const now = Date.now();
      if (now - lastErrRefetch < 2000) return;
      lastErrRefetch = now;
      void refresh();
    };

    return () => es.close();
  }, [refresh]);

  return { status, refresh };
}
