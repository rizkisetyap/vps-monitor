import { NextResponse } from "next/server";
import { getSystemSnapshot } from "@/lib/system";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getSystemSnapshot();
    return NextResponse.json(snapshot);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to read system stats" }, { status: 500 });
  }
}
