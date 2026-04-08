function stripTrailingSlash(u: string) {
  return u.replace(/\/$/, "");
}

export function getBackendBaseUrl() {
  if (
    process.env.NEXT_PUBLIC_API_RELATIVE === "1" &&
    typeof window !== "undefined"
  ) {
    return "";
  }
  const url =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8083")
      : (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8083");

  return stripTrailingSlash(url);
}

export function getWebSocketHttpOrigin() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_BACKEND_URL;
  if (wsUrl) {
    return stripTrailingSlash(wsUrl);
  }
  if (
    process.env.NEXT_PUBLIC_API_RELATIVE === "1" &&
    typeof window !== "undefined"
  ) {
    return stripTrailingSlash(
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8083",
    );
  }
  return getBackendBaseUrl();
}
