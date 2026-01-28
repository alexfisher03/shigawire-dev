export function getBackendBaseUrl() {
  // In client-side code, use NEXT_PUBLIC_ prefix
  // In server-side code, use BACKEND_INTERNAL_URL
  const url = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080")
    : (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8080");
  
  return url.replace(/\/$/, "");
}
