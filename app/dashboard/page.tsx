"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import MetricCard from "@/components/MetricCard";
import Pm2Table from "@/components/Pm2Table";
import NginxPanel from "@/components/NginxPanel";
import { SystemSnapshot } from "@/lib/system";
import { Pm2Process } from "@/lib/pm2";
import { NginxStatus } from "@/lib/nginx";
import { formatBytes, formatUptimeSeconds } from "@/lib/format";

const POLL_MS = 4000;
const HISTORY_LENGTH = 24;

export default function DashboardPage() {
  const router = useRouter();

  const [system, setSystem] = useState<SystemSnapshot | null>(null);
  const [processes, setProcesses] = useState<Pm2Process[]>([]);
  const [nginxStatus, setNginxStatus] = useState<NginxStatus | null>(null);
  const [nginxSites, setNginxSites] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [pm2Pending, setPm2Pending] = useState<Record<string, boolean>>({});
  const [nginxPending, setNginxPending] = useState(false);
  const [nginxTestOutput, setNginxTestOutput] = useState<{ ok: boolean; output: string } | null>(
    null
  );

  const cpuHistory = useRef<number[]>([]);
  const memHistory = useRef<number[]>([]);
  const [, forceRender] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [sysRes, pm2Res, nginxRes] = await Promise.all([
        fetch("/api/system"),
        fetch("/api/pm2"),
        fetch("/api/nginx")
      ]);

      if (sysRes.status === 401 || pm2Res.status === 401 || nginxRes.status === 401) {
        router.replace("/login");
        return;
      }

      const sysData = await sysRes.json();
      const pm2Data = await pm2Res.json();
      const nginxData = await nginxRes.json();

      if (sysRes.ok) {
        setSystem(sysData);
        cpuHistory.current = [...cpuHistory.current, sysData.cpu.currentLoadPercent].slice(
          -HISTORY_LENGTH
        );
        memHistory.current = [...memHistory.current, sysData.memory.usedPercent].slice(
          -HISTORY_LENGTH
        );
        forceRender((n) => n + 1);
      }
      if (pm2Res.ok) setProcesses(pm2Data.processes ?? []);
      if (nginxRes.ok) {
        setNginxStatus(nginxData.status ?? null);
        setNginxSites(nginxData.sites ?? []);
      }

      setError(null);
    } catch {
      setError("Lost connection to the server. Retrying…");
    }
  }, [router]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function handlePm2Action(name: string, action: "restart" | "stop" | "start") {
    setPm2Pending((p) => ({ ...p, [name]: true }));
    try {
      const res = await fetch(`/api/pm2/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? `Failed to ${action} ${name}`);
      await refresh();
    } finally {
      setPm2Pending((p) => ({ ...p, [name]: false }));
    }
  }

  async function handleNginxAction(action: "reload" | "restart" | "stop" | "start" | "test") {
    setNginxPending(true);
    setNginxTestOutput(null);
    try {
      const res = await fetch("/api/nginx/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (action === "test") {
        setNginxTestOutput(data);
      } else if (!res.ok) {
        setError(data.error ?? `Failed to ${action} nginx`);
      }
      await refresh();
    } finally {
      setNginxPending(false);
    }
  }

  return (
    <div className="page">
      <TopBar hostname={system?.hostname} onLogout={handleLogout} />

      {error && <div className="banner banner-error">{error}</div>}

      <div className="section">
        <p className="section-title">System</p>
        <div className="metric-grid">
          <MetricCard
            label="CPU load"
            value={system ? `${system.cpu.currentLoadPercent}%` : "—"}
            sub={system ? `${system.cpu.cores} cores · ${system.cpu.brand}` : undefined}
            history={cpuHistory.current}
          />
          <MetricCard
            label="Memory"
            value={system ? `${system.memory.usedPercent}%` : "—"}
            sub={
              system
                ? `${formatBytes(system.memory.usedBytes)} / ${formatBytes(system.memory.totalBytes)}`
                : undefined
            }
            history={memHistory.current}
          />
          <MetricCard
            label="Disk"
            value={system?.disks[0] ? `${system.disks[0].usedPercent}%` : "—"}
            sub={
              system?.disks[0]
                ? `${formatBytes(system.disks[0].usedBytes)} / ${formatBytes(system.disks[0].sizeBytes)} · ${system.disks[0].mount}`
                : undefined
            }
          />
          <MetricCard
            label="Uptime"
            value={system ? formatUptimeSeconds(system.uptimeSeconds) : "—"}
            sub={system?.platform}
          />
        </div>
      </div>

      <div className="section">
        <p className="section-title">PM2 processes</p>
        <Pm2Table processes={processes} pending={pm2Pending} onAction={handlePm2Action} />
      </div>

      <div className="section">
        <p className="section-title">Nginx</p>
        <NginxPanel
          status={nginxStatus}
          sites={nginxSites}
          pending={nginxPending}
          testOutput={nginxTestOutput}
          onAction={handleNginxAction}
        />
      </div>
    </div>
  );
}
