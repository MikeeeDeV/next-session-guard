// This module's built output includes "use server" directive via tsup config

/**
 * next-session-guard/actions
 *
 * Ready-to-use Next.js Server Actions — no API routes required.
 * Import from "next-session-guard/actions"
 *
 * @example
 * ```ts
 * // lib/session-actions.ts
 * import { createSessionActions } from "next-session-guard/actions";
 * import { prisma } from "@/lib/prisma";
 * import { auth } from "@/lib/auth";
 *
 * export const { getSessions, revokeSession, revokeOtherSessions } = createSessionActions({
 *   getPrisma: () => prisma,
 *   getCurrentUser: async () => {
 *     const session = await auth();
 *     if (!session?.user?.id) return null;
 *     return { id: session.user.id, sessionToken: (session as any).sessionToken };
 *   },
 * });
 * ```
 */

import { SessionManager } from "../core/session-manager";
import type { ActiveSessionDTO, SessionManagerConfig } from "../core/types";

export interface SessionActionsConfig {
  /** Function returning the Prisma client instance */
  getPrisma: () => any;

  /** Function returning the current authenticated user, or null */
  getCurrentUser: () => Promise<{ id: string; sessionToken?: string } | null>;

  /** Optional SessionManager configuration */
  managerConfig?: SessionManagerConfig;
}

export interface SessionActionsResult {
  /** Fetch all active sessions for the current user */
  getSessions: () => Promise<{
    sessions?: ActiveSessionDTO[];
    error?: string;
  }>;

  /** Revoke a specific session by ID */
  revokeSession: (sessionId: string) => Promise<{
    success?: boolean;
    error?: string;
  }>;

  /** Revoke all sessions except the current one */
  revokeOtherSessions: () => Promise<{
    success?: boolean;
    revokedCount?: number;
    error?: string;
  }>;
}

/**
 * Creates typed Server Actions for session management.
 * Returns three actions: `getSessions`, `revokeSession`, `revokeOtherSessions`.
 */
export function createSessionActions(config: SessionActionsConfig): SessionActionsResult {
  const { getPrisma, getCurrentUser, managerConfig } = config;

  async function getSessions(): Promise<{
    sessions?: ActiveSessionDTO[];
    error?: string;
  }> {
    try {
      const user = await getCurrentUser();
      if (!user?.id) return { error: "Unauthorized" };

      const manager = new SessionManager(getPrisma(), managerConfig);
      const sessions = await manager.getUserSessions(user.id, user.sessionToken);

      return { sessions };
    } catch (error: any) {
      console.error("[SessionGuard Action] getSessions Error:", error);
      return { error: "Failed to retrieve active sessions" };
    }
  }

  async function revokeSession(sessionId: string): Promise<{
    success?: boolean;
    error?: string;
  }> {
    try {
      const user = await getCurrentUser();
      if (!user?.id) return { error: "Unauthorized" };

      if (!sessionId) return { error: "Session ID is required" };

      const manager = new SessionManager(getPrisma(), managerConfig);
      const success = await manager.revokeSession({
        sessionId,
        userId: user.id,
      });

      if (!success) return { error: "Session not found or already revoked" };

      return { success: true };
    } catch (error: any) {
      console.error("[SessionGuard Action] revokeSession Error:", error);
      return { error: "Failed to revoke session" };
    }
  }

  async function revokeOtherSessions(): Promise<{
    success?: boolean;
    revokedCount?: number;
    error?: string;
  }> {
    try {
      const user = await getCurrentUser();
      if (!user?.id) return { error: "Unauthorized" };

      const manager = new SessionManager(getPrisma(), managerConfig);
      const revokedCount = await manager.revokeOtherSessions({
        userId: user.id,
        currentSessionToken: user.sessionToken,
      });

      return { success: true, revokedCount };
    } catch (error: any) {
      console.error("[SessionGuard Action] revokeOtherSessions Error:", error);
      return { error: "Failed to revoke other sessions" };
    }
  }

  return { getSessions, revokeSession, revokeOtherSessions };
}
