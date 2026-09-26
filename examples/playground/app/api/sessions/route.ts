import { NextResponse } from "next/server";
import { sessionManager, ensureSampleSessions } from "../../../lib/session";

export async function GET() {
  await ensureSampleSessions();
  const sessions = await sessionManager.getUserActiveSessions("demo_user_1", "demo_current_token_123");
  return NextResponse.json({ sessions });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { sessionId } = body;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const success = await sessionManager.revokeSession({
    userId: "demo_user_1",
    sessionId,
  });

  return NextResponse.json({ success });
}
