import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface Pm2Process {
  name: string;
  pmId: number;
  pid: number | null;
  status: string;
  cpu: number;
  memoryBytes: number;
  uptimeMs: number | null;
  restarts: number;
}

export type Pm2Action = "restart" | "stop" | "start" | "reload";

const ALLOWED_ACTIONS: Pm2Action[] = ["restart", "stop", "start", "reload"];

function getAllowList(): string[] | null {
  const raw = process.env.PM2_ALLOWED_APPS?.trim();
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAppAllowed(name: string): boolean {
  const allowList = getAllowList();
  if (!allowList) return true;
  return allowList.includes(name);
}

export async function listPm2Processes(): Promise<Pm2Process[]> {
  const { stdout } = await execFileAsync("pm2", ["jlist"], { maxBuffer: 10 * 1024 * 1024 });
  const raw = JSON.parse(stdout) as any[];

  return raw.map((p) => ({
    name: p.name,
    pmId: p.pm_id,
    pid: p.pid ?? null,
    status: p.pm2_env?.status ?? "unknown",
    cpu: p.monit?.cpu ?? 0,
    memoryBytes: p.monit?.memory ?? 0,
    uptimeMs: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : null,
    restarts: p.pm2_env?.restart_time ?? 0
  }));
}

export async function runPm2Action(name: string, action: Pm2Action): Promise<void> {
  if (!ALLOWED_ACTIONS.includes(action)) {
    throw new Error(`Unsupported action: ${action}`);
  }
  if (!isAppAllowed(name)) {
    throw new Error(`App "${name}" is not in PM2_ALLOWED_APPS`);
  }
  // execFile (no shell) with args as an array — the process name can never
  // be interpreted as a shell command, so this is safe against injection.
  await execFileAsync("pm2", [action, name], { maxBuffer: 1024 * 1024 });
}

export async function getPm2Logs(name: string, lines = 100): Promise<string> {
  if (!isAppAllowed(name)) {
    throw new Error(`App "${name}" is not in PM2_ALLOWED_APPS`);
  }
  const { stdout } = await execFileAsync(
    "pm2",
    ["logs", name, "--lines", String(lines), "--nostream"],
    { maxBuffer: 5 * 1024 * 1024 }
  );
  return stdout;
}
