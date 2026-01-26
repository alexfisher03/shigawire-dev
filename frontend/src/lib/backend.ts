export function getBackendBaseUrl() {
  return (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8080").replace(
    /\/$/,
    "",
  );
}
