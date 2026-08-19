type Tone = "ok" | "warn" | "danger" | "neutral";

const STATUS_TONE: Record<string, Tone> = {
  online: "ok",
  active: "ok",
  running: "ok",
  launching: "warn",
  stopping: "warn",
  restarting: "warn",
  stopped: "neutral",
  inactive: "neutral",
  errored: "danger",
  failed: "danger"
};

export function toneForStatus(status: string): Tone {
  return STATUS_TONE[status.toLowerCase()] ?? "neutral";
}

export default function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`pill pill-${tone}`}>{label}</span>;
}
