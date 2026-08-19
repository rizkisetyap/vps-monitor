import { NextResponse } from "next/server";
import { getNginxStatus, listEnabledSites } from "@/lib/nginx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [status, sites] = await Promise.all([getNginxStatus(), listEnabledSites()]);
    return NextResponse.json({ status, sites });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to read nginx status" }, { status: 500 });
  }
}
