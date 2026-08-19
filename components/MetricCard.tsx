export default function MetricCard({
  label,
  value,
  sub,
  history,
  maxValue = 100
}: {
  label: string;
  value: string;
  sub?: string;
  history?: number[];
  maxValue?: number;
}) {
  return (
    <div className="card metric-card">
      <div className="metric-label">
        <span>{label}</span>
      </div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
      {history && history.length > 1 && (
        <div className="sparkline" aria-hidden="true">
          {history.map((v, i) => {
            const pct = Math.max(2, Math.min(100, (v / maxValue) * 100));
            return <div key={i} className="sparkline-bar" style={{ height: `${pct}%` }} />;
          })}
        </div>
      )}
    </div>
  );
}
