import { NextRequest, NextResponse } from "next/server";
import { runPm2Action, getPm2Logs, Pm2Action } from "@/lib/pm2";

export const runtime = "nodejs";

const VALID_ACTIONS: Pm2Action[] = ["restart", "stop", "start", "reload"];

export async function POST(req: NextRequest, { params }: { params: { name: string } }) {
  const body = await req.json().catch(() => null);
  const action = body?.action as Pm2Action | undefined;

  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    await runPm2Action(decodeURIComponent(params.name), action);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "pm2 action failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const lines = Number(req.nextUrl.searchParams.get("lines") ?? "100");
  try {
    const logs = await getPm2Logs(decodeURIComponent(params.name), Number.isFinite(lines) ? lines : 100);
    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch logs" }, { status: 500 });
  }
}
