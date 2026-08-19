import { Pm2Process } from "@/lib/pm2";
import { formatBytes, formatDuration } from "@/lib/format";
import StatusPill, { toneForStatus } from "./StatusPill";

export default function Pm2Table({
  processes,
  pending,
  onAction
}: {
  processes: Pm2Process[];
  pending: Record<string, boolean>;
  onAction: (name: string, action: "restart" | "stop" | "start") => void;
}) {
  if (processes.length === 0) {
    return (
      <div className="table-wrap">
        <div className="empty">No pm2 processes found for this user.</div>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Process</th>
            <th>Status</th>
            <th>CPU</th>
            <th>Memory</th>
            <th>Uptime</th>
            <th>Restarts</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {processes.map((p) => {
            const isPending = !!pending[p.name];
            const isStopped = p.status.toLowerCase() === "stopped";
            return (
              <tr key={p.pmId} className="row-fade">
                <td className="proc-name">{p.name}</td>
                <td>
                  <StatusPill label={p.status} tone={toneForStatus(p.status)} />
                </td>
                <td className="mono">{p.cpu.toFixed(1)}%</td>
                <td className="mono">{formatBytes(p.memoryBytes)}</td>
                <td className="mono">{formatDuration(p.uptimeMs)}</td>
                <td className="mono">{p.restarts}</td>
                <td>
                  <div className="btn-row">
                    {!isStopped && (
                      <>
                        <button
                          className="btn"
                          disabled={isPending}
                          onClick={() => onAction(p.name, "restart")}
                        >
                          Restart
                        </button>
                        <button
                          className="btn btn-danger"
                          disabled={isPending}
                          onClick={() => onAction(p.name, "stop")}
                        >
                          Stop
                        </button>
                      </>
                    )}
                    {isStopped && (
                      <button
                        className="btn"
                        disabled={isPending}
                        onClick={() => onAction(p.name, "start")}
                      >
                        Start
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
