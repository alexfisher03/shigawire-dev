export function subscribeReconnectingEventSource(
  url: string,
  handlers: {
    onOpen?: () => void;
    onMessage: (ev: MessageEvent) => void;
    onConnectionLost?: () => void;
  },
): () => void {
  let es: EventSource | null = null;
  let cancelled = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const connect = () => {
    if (cancelled) return;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    try {
      es?.close();
    } catch {
      /* ignore */
    }
    es = new EventSource(url);
    es.onopen = () => {
      attempt = 0;
      handlers.onOpen?.();
    };
    es.onmessage = handlers.onMessage;
    es.onerror = () => {
      handlers.onConnectionLost?.();
      try {
        es?.close();
      } catch {
        /* ignore */
      }
      es = null;
      if (cancelled) return;
      const delay = Math.min(6000, 300 + attempt * 150);
      attempt += 1;
      timer = setTimeout(connect, delay);
    };
  };

  connect();

  return () => {
    cancelled = true;
    if (timer !== undefined) clearTimeout(timer);
    try {
      es?.close();
    } catch {
      /* ignore */
    }
  };
}
