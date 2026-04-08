function stripTrailingSlash(u: string) {
  return u.replace(/\/$/, "");
}

function clientUsesRelativeApi(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_API_RELATIVE === "1") return true;
  if (process.env.NODE_ENV !== "development") return false;
  const { hostname, port } = window.location;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return false;
  return port === "3000";
}

export function getBackendBaseUrl() {
  if (clientUsesRelativeApi()) {
    return "";
  }
  const url =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8083")
      : (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8083");

  return stripTrailingSlash(url);
}

/** Same-origin fetches use Next rewrites; EventSource often buffers or breaks on that path, so use the real API origin (like WebSockets). */
export function getRecordingStreamUrl(): string {
  if (clientUsesRelativeApi()) {
    return `${stripTrailingSlash(
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8083",
    )}/api/v1/record/stream`;
  }
  return `${getBackendBaseUrl()}/api/v1/record/stream`;
}

export function getWebSocketHttpOrigin() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_BACKEND_URL;
  if (wsUrl) {
    return stripTrailingSlash(wsUrl);
  }
  if (clientUsesRelativeApi()) {
    return stripTrailingSlash(
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8083",
    );
  }
  return getBackendBaseUrl();
}
