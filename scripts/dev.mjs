import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2).filter((arg) => arg !== "--strictPort").map((arg) => {
  if (arg === "--host") return "--hostname";
  if (arg.startsWith("--host=")) return arg.replace("--host=", "--hostname=");
  return arg;
});
const portArg = args.find((arg) => arg.startsWith("--port="));
const portIndex = args.findIndex((arg) => arg === "--port" || arg === "-p");
const port = Number(portArg?.split("=")[1] || (portIndex >= 0 && args[portIndex + 1]) || process.env.PORT || 3000);
const apiPort = process.env.ATLAS_API_PORT || String(port + 1000);
const python = process.env.ATLAS_PYTHON || (existsSync(".venv/bin/python") ? ".venv/bin/python" : "python");
const env = { ...process.env, ATLAS_API_URL: `http://127.0.0.1:${apiPort}` };
const bind = args.some((arg) => arg === "--hostname" || arg === "-H" || arg.startsWith("--hostname=")) ? [] : ["--hostname", "127.0.0.1"];
const api = spawn(python, ["-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", apiPort], {
  stdio: "inherit",
  env: { ...env, ATLAS_DEMO_DATA: env.ATLAS_DEMO_DATA ?? "1" },
});
const frontend = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "dev", ...bind, ...args, ...(portIndex < 0 && !portArg ? ["--port", String(port)] : [])], {
  stdio: "inherit",
  env,
});

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  api.kill();
  frontend.kill();
  process.exitCode = code;
}
for (const child of [api, frontend]) {
  child.on("exit", (code) => stop(code ?? 0));
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
}
process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));
