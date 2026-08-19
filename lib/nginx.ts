import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";

const execFileAsync = promisify(execFile);

export type NginxAction = "reload" | "restart" | "stop" | "start";
const ALLOWED_ACTIONS: NginxAction[] = ["reload", "restart", "stop", "start"];

function serviceName() {
  return process.env.NGINX_SERVICE_NAME?.trim() || "nginx";
}

export interface NginxStatus {
  active: boolean;
  raw: string;
}

/** Read-only status check — does not require sudo. */
export async function getNginxStatus(): Promise<NginxStatus> {
  try {
    const { stdout } = await execFileAsync("systemctl", ["is-active", serviceName()]);
    const raw = stdout.trim();
    return { active: raw === "active", raw };
  } catch (err: any) {
    // systemctl exits non-zero for inactive/failed units; stdout still has the state.
    const raw = (err.stdout ?? "unknown").trim();
    return { active: false, raw };
  }
}

export async function listEnabledSites(): Promise<string[]> {
  const dir = process.env.NGINX_SITES_ENABLED_DIR?.trim();
  if (!dir) return [];
  try {
    const entries = await fs.readdir(dir);
    return entries.sort();
  } catch {
    return [];
  }
}

/**
 * Mutating actions require passwordless sudo for this exact command —
 * see deploy/setup-sudoers.sh. `sudo -n` fails fast instead of hanging
 * if that hasn't been configured.
 */
export async function runNginxAction(action: NginxAction): Promise<void> {
  if (!ALLOWED_ACTIONS.includes(action)) {
    throw new Error(`Unsupported action: ${action}`);
  }
  await execFileAsync("sudo", ["-n", "systemctl", action, serviceName()], {
    maxBuffer: 1024 * 1024
  });
}

export async function testNginxConfig(): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execFileAsync("sudo", ["-n", "nginx", "-t"], {
      maxBuffer: 1024 * 1024
    });
    return { ok: true, output: `${stdout}${stderr}`.trim() };
  } catch (err: any) {
    return { ok: false, output: `${err.stdout ?? ""}${err.stderr ?? ""}`.trim() || String(err) };
  }
}
