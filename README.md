# Shigawire

An HTTP recording and replay proxy packaged as a desktop application. Shigawire sits between your HTTP client and an upstream service, capturing every request and response with full headers and bodies. Sensitive information is automatically redacted before storage.

## Architecture

| Layer | Stack | Port |
|-------|-------|------|
| Desktop shell | Tauri 2 (Rust) | — |
| Frontend | Next.js 16 + React 19 + Tailwind 4 | 3000 (dev) |
| API server | Go 1.25 + Fiber | 8083 |
| Proxy | Go `net/http` reverse proxy | 9090 |
| Database | SQLite | file-based |

## Development

You need **two terminals** running simultaneously.

### Terminal 1 — Backend (Go API + Proxy)

```bash
docker compose up
```

This starts the Go backend on port **8083** (API) and port **9090** (proxy), backed by a SQLite database at `data/shigawire.sqlite`. The Go module cache is persisted in a Docker volume so rebuilds are fast.

### Terminal 2 — Frontend + Tauri shell

```bash
cd frontend
npm install
npm run tauri:dev
```

The Next.js dev server proxies `/api/v1/*` requests to `http://127.0.0.1:8083`, so the frontend talks to the Docker backend transparently.

### Sending traffic through the proxy

With both terminals running, point any HTTP client at `http://localhost:9090`:

```bash
curl http://localhost:9090/api/v1/users
```

If a session is recording, the request is forwarded to the configured upstream and the full round-trip is captured. If not recording, it forwards to `DEFAULT_UPSTREAM_BASE_URL` without capturing.

## Building for release

```bash
cd frontend
npm run tauri:build
```

Produces a `.dmg` (macOS) or NSIS installer (Windows) in `frontend/src-tauri/target/release/bundle/`. The Go sidecar is compiled and embedded automatically.
