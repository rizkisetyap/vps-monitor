import { NginxStatus } from "@/lib/nginx";
import StatusPill from "./StatusPill";

export default function NginxPanel({
  status,
  sites,
  pending,
  testOutput,
  onAction
}: {
  status: NginxStatus | null;
  sites: string[];
  pending: boolean;
  testOutput: { ok: boolean; output: string } | null;
  onAction: (action: "reload" | "restart" | "stop" | "start" | "test") => void;
}) {
  return (
    <div className="card">
      <div className="panel-header">
        <div className="btn-row" style={{ alignItems: "center" }}>
          {status ? (
            <StatusPill label={status.raw} tone={status.active ? "ok" : "danger"} />
          ) : (
            <span className="muted">checking…</span>
          )}
        </div>
        <div className="btn-row">
          <button className="btn" disabled={pending} onClick={() => onAction("reload")}>
            Reload
          </button>
          <button className="btn" disabled={pending} onClick={() => onAction("restart")}>
            Restart
          </button>
          {status?.active ? (
            <button className="btn btn-danger" disabled={pending} onClick={() => onAction("stop")}>
              Stop
            </button>
          ) : (
            <button className="btn" disabled={pending} onClick={() => onAction("start")}>
              Start
            </button>
          )}
          <button className="btn" disabled={pending} onClick={() => onAction("test")}>
            Test config
          </button>
        </div>
      </div>

      {testOutput && (
        <div className={`banner ${testOutput.ok ? "banner-ok" : "banner-error"}`}>
          <pre className="mono" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {testOutput.output || (testOutput.ok ? "Config OK" : "Config test failed")}
          </pre>
        </div>
      )}

      {sites.length > 0 ? (
        <div className="sites-list">
          {sites.map((s) => (
            <div key={s} className="site-row">
              {s}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">No sites-enabled directory configured or none found.</div>
      )}
    </div>
  );
}
