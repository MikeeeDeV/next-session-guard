import { NextResponse } from "next/server";
import { sessionManager } from "../../../../lib/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { schedule, retentionDays, revokedOnly } = body;

  const result = await sessionManager.cleanupExpiredSessions({
    schedule: schedule || "monthly",
    retentionDays: retentionDays ? Number(retentionDays) : undefined,
    revokedOnly: Boolean(revokedOnly),
  });

  return NextResponse.json({ success: true, result });
}
