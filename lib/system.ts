import si from "systeminformation";
import os from "os";

export interface SystemSnapshot {
  hostname: string;
  platform: string;
  uptimeSeconds: number;
  loadAvg: number[];
  cpu: {
    manufacturer: string;
    brand: string;
    cores: number;
    currentLoadPercent: number;
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    usedPercent: number;
  };
  disks: Array<{
    fs: string;
    mount: string;
    sizeBytes: number;
    usedBytes: number;
    usedPercent: number;
  }>;
  network: {
    iface: string;
    rxSec: number;
    txSec: number;
  } | null;
}

export async function getSystemSnapshot(): Promise<SystemSnapshot> {
  const [cpuInfo, currentLoad, mem, fsSize, netStats, time] = await Promise.all([
    si.cpu(),
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
    si.time()
  ]);

  const primaryNet = netStats[0] ?? null;

  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    uptimeSeconds: time.uptime,
    loadAvg: os.loadavg(),
    cpu: {
      manufacturer: cpuInfo.manufacturer,
      brand: cpuInfo.brand,
      cores: cpuInfo.cores,
      currentLoadPercent: Math.round(currentLoad.currentLoad * 10) / 10
    },
    memory: {
      totalBytes: mem.total,
      usedBytes: mem.active,
      usedPercent: Math.round((mem.active / mem.total) * 1000) / 10
    },
    disks: fsSize
      .filter((d) => d.mount && d.size > 0)
      .map((d) => ({
        fs: d.fs,
        mount: d.mount,
        sizeBytes: d.size,
        usedBytes: d.used,
        usedPercent: Math.round(d.use * 10) / 10
      })),
    network: primaryNet
      ? {
          iface: primaryNet.iface,
          rxSec: primaryNet.rx_sec ?? 0,
          txSec: primaryNet.tx_sec ?? 0
        }
      : null
  };
}
