import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, "..");
const repoRoot = path.join(frontendRoot, "..");
const backendDir = path.join(repoRoot, "backend");
const binariesDir = path.join(frontendRoot, "src-tauri", "binaries");

let targetTriple;
try {
  targetTriple = execSync("rustc --print host-tuple", { encoding: "utf8" }).trim();
} catch {
  console.error("prepare-sidecar: install Rust so `rustc --print host-tuple` works");
  process.exit(1);
}
if (!targetTriple) {
  console.error("prepare-sidecar: empty host tuple from rustc");
  process.exit(1);
}

const ext = process.platform === "win32" ? ".exe" : "";
const dest = path.join(binariesDir, `shigawire-server-${targetTriple}${ext}`);

fs.mkdirSync(binariesDir, { recursive: true });

execSync(`go build -o "${dest}" ./cmd/server`, {
  cwd: backendDir,
  stdio: "inherit",
});

console.log("prepare-sidecar: built", dest);
