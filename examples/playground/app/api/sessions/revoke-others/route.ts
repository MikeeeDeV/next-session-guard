import { NextResponse } from "next/server";
import { sessionManager } from "../../../../lib/session";

export async function POST() {
  const count = await sessionManager.revokeOtherSessions({
    userId: "demo_user_1",
    currentSessionToken: "demo_current_token_123",
  });

  return NextResponse.json({ success: true, revokedCount: count });
}
