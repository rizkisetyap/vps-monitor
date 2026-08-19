import { NextResponse } from "next/server";
import { listPm2Processes } from "@/lib/pm2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const processes = await listPm2Processes();
    return NextResponse.json({ processes });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to list pm2 processes" },
      { status: 500 }
    );
  }
}
