import { NextRequest, NextResponse } from "next/server";
import { SessionManager } from "../core/session-manager";

/**
 * Example Next.js App Router API Route Handler for `/api/sessions/revoke-others`
 *
 * Copy or import this handler into:
 * `src/app/api/sessions/revoke-others/route.ts`
 */
export function createRevokeOthersHandler(
  getPrisma: () => any,
  getCurrentUser: (req: NextRequest) => Promise<{ id: string; sessionToken?: string } | null>
) {
  return async function POST(req: NextRequest) {
    try {
      const user = await getCurrentUser(req);
      if (!user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const manager = new SessionManager(getPrisma());
      const revokedCount = await manager.revokeOtherSessions({
        userId: user.id,
        currentSessionToken: user.sessionToken,
      });

      return NextResponse.json({
        success: true,
        revokedCount,
        message: `Successfully signed out from ${revokedCount} other session(s).`,
      });
    } catch (error: any) {
      console.error("[SessionGuard API] Revoke Others Error:", error);
      return NextResponse.json(
        { error: "Failed to revoke other sessions" },
        { status: 500 }
      );
    }
  };
}

