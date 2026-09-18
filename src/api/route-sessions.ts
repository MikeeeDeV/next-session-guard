import { NextRequest, NextResponse } from "next/server";
import { SessionManager } from "../core/session-manager";

/**
 * Example Next.js App Router API Route Handler for `/api/sessions`
 *
 * Copy or import these handlers directly into your:
 * `src/app/api/sessions/route.ts`
 */
export function createSessionsRouteHandlers(
  getPrisma: () => any,
  getCurrentUser: (req: NextRequest) => Promise<{ id: string; sessionToken?: string } | null>
) {
  return {
    /**
     * GET /api/sessions
     * Returns list of active sessions for the current authenticated user
     */
    async GET(req: NextRequest) {
      try {
        const user = await getCurrentUser(req);
        if (!user?.id) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const manager = new SessionManager(getPrisma());
        const sessions = await manager.getUserSessions(user.id, user.sessionToken);

        return NextResponse.json({ sessions });
      } catch (error: any) {
        console.error("[SessionGuard API] GET Error:", error);
        return NextResponse.json(
          { error: "Failed to retrieve active sessions" },
          { status: 500 }
        );
      }
    },

    /**
     * DELETE /api/sessions?id=SESSION_ID
     * Revokes a specific session
     */
    async DELETE(req: NextRequest) {
      try {
        const user = await getCurrentUser(req);
        if (!user?.id) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get("id");

        if (!sessionId) {
          return NextResponse.json(
            { error: "Session ID is required" },
            { status: 400 }
          );
        }

        const manager = new SessionManager(getPrisma());
        const success = await manager.revokeSession({
          sessionId,
          userId: user.id,
        });

        if (!success) {
          return NextResponse.json(
            { error: "Session not found or already revoked" },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true });
      } catch (error: any) {
        console.error("[SessionGuard API] DELETE Error:", error);
        return NextResponse.json(
          { error: "Failed to revoke session" },
          { status: 500 }
        );
      }
    },
  };
}

