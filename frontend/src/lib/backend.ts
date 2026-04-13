function stripTrailingSlash(u: string) {
  return u.replace(/\/$/, "");
}

export const TAURI_EMBEDDED_BACKEND_ORIGIN = "http://127.0.0.1:18453";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function clientUsesRelativeApi(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_API_RELATIVE === "1") return true;
  if (process.env.NODE_ENV !== "development") return false;
  const { hostname, port } = window.location;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return false;
  return port === "3000";
}

function defaultBackendUrlForBrowser(): string {
  if (isTauriRuntime()) {
    return (
      process.env.NEXT_PUBLIC_BACKEND_URL?.trim() || TAURI_EMBEDDED_BACKEND_ORIGIN
    );
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8083";
}

export function getBackendBaseUrl() {
  if (clientUsesRelativeApi()) {
    return "";
  }
  const url =
    typeof window !== "undefined"
      ? defaultBackendUrlForBrowser()
      : (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8083");

  return stripTrailingSlash(url);
}

const API_FETCH_RETRIES = 35;
const API_FETCH_RETRY_MS = 175;

export async function apiFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < API_FETCH_RETRIES; attempt++) {
    try {
      return await fetch(input, init);
    } catch (e) {
      lastError = e;
      if (attempt < API_FETCH_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, API_FETCH_RETRY_MS));
      }
    }
  }
  throw lastError;
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

export function getEventStreamUrl(): string {
  if (clientUsesRelativeApi()) {
    return `${stripTrailingSlash(
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8083",
    )}/api/v1/events/stream`;
  }
  return `${getBackendBaseUrl()}/api/v1/events/stream`;
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
