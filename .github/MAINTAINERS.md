# Repository settings (maintainers)

## CI vs release (two separate workflows)

- **`ci.yml`** runs on **pushes and pull requests to `main`**.
- **`release-desktop.yml`** runs on **`v*` tag push**. In practice you merge to `main` (CI should be green), **then** tag and push so you are not releasing unverified code.

## CI jobs (`.github/workflows/ci.yml`)

| Job | Purpose |
|-----|--------|
| **Frontend (Next.js build)** | `npm ci`, `next build` (TypeScript included). |
| **Backend (Go)** | `go vet`, `go build`. |
| **Tauri (Rust + sidecar)** | Linux packages for WebKitGTK, Go sidecar, `cargo check`. |
| **Backend (gofmt)** | Fails if any `.go` file needs `gofmt`. |
| **Tauri (rustfmt)** | `cargo fmt --check` (no GUI libs needed). |
| **Workflows (actionlint)** | Validates `.github/workflows/*.yml`. |
| **CI passed** | Runs after all of the above; **fails if any of them failed or was cancelled**.


## Tags and releases

Desktop installers are built by **Build desktop installers** when you push a tag matching `v*` (and `workflow_dispatch`).

1. Merge work to `main` via PR (CI green).
2. `git tag vX.Y.Z && git push origin vX.Y.Z`
