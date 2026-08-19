export default function TopBar({
  hostname,
  onLogout
}: {
  hostname?: string;
  onLogout: () => void;
}) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="brand">VPS Monitor</span>
        {hostname && <span className="hostname">{hostname}</span>}
        <span className="live-dot-wrap">
          <span className="live-dot" />
          live
        </span>
      </div>
      <button className="btn" onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}
