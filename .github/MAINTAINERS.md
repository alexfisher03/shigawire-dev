# Repository settings (maintainers)

## Tags and releases

Desktop installers are built by **Build desktop installers** when you push a tag matching `v*` (and `workflow_dispatch`). Typical flow:

1. Merge work to `main` via PR (with CI green).
2. `git tag vX.Y.Z && git push origin vX.Y.Z`

## CI (`.github/workflows/ci.yml`)

- **Frontend** runs `npm ci` and `next build` (includes TypeScript). ESLint is not gated in CI yet; run `npm run lint` locally when cleaning up rules. `eslint.config.mjs` ignores `src-tauri/target` so Rust outputs are not linted.
