import { NextRequest, NextResponse } from "next/server";
import { runNginxAction, testNginxConfig, NginxAction } from "@/lib/nginx";

export const runtime = "nodejs";

const VALID_ACTIONS: (NginxAction | "test")[] = ["reload", "restart", "stop", "start", "test"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const action = body?.action as NginxAction | "test" | undefined;

  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    if (action === "test") {
      const result = await testNginxConfig();
      return NextResponse.json(result);
    }
    await runNginxAction(action);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const message = err.message ?? "nginx action failed";
    const hint = message.includes("sudo")
      ? " — check that deploy/setup-sudoers.sh has been applied for this user"
      : "";
    return NextResponse.json({ error: message + hint }, { status: 500 });
  }
}
