import {
  ActiveSessionDTO,
  CreateSessionOptions,
  MinimalPrismaClient,
  RevokeOtherSessionsOptions,
  RevokeSessionOptions,
  SessionManagerConfig,
} from "./types";
import { getClientMetadata, parseClientInfo } from "./ua-parser";

export class SessionManager {
  private prisma: MinimalPrismaClient;
  private config: Required<SessionManagerConfig>;

  constructor(prismaClient: any, config?: SessionManagerConfig) {
    this.prisma = prismaClient as MinimalPrismaClient;
    this.config = {
      maxConcurrentSessions: config?.maxConcurrentSessions ?? 0, // 0 = unlimited
      sessionDurationDays: config?.sessionDurationDays ?? 30,
      activityThrottleSeconds: config?.activityThrottleSeconds ?? 300, // 5 minutes
    };
  }

  /**
   * Registers a new active session for a user with client & device metadata
   */
  async createSession(options: CreateSessionOptions) {
    const { userId, sessionToken } = options;

    // Resolve client metadata
    let clientInfo: {
      deviceType: string;
      browser: string;
      os: string;
      ipAddress?: string;
      rawUserAgent?: string;
    };

    if (options.req) {
      clientInfo = getClientMetadata(options.req);
    } else {
      clientInfo = parseClientInfo(options.userAgent, options.ipAddress);
    }

    const token = sessionToken || this.generateSessionToken();

    const expires =
      options.expiresAt ||
      new Date(Date.now() + this.config.sessionDurationDays * 24 * 60 * 60 * 1000);

    // Enforce max concurrent sessions if configured
    if (this.config.maxConcurrentSessions > 0) {
      await this.enforceConcurrentLimit(userId, this.config.maxConcurrentSessions);
    }

    const session = await this.prisma.session.create({
      data: {
        sessionToken: token,
        userId,
        expires,
        ipAddress: clientInfo.ipAddress || null,
        userAgent: clientInfo.rawUserAgent || null,
        deviceType: clientInfo.deviceType,
        browser: clientInfo.browser,
        os: clientInfo.os,
        lastActiveAt: new Date(),
        isRevoked: false,
      },
    });

    return session;
  }

  /**
   * Validates whether a session is valid, active, and unrevoked.
   * Also automatically throttles and updates `lastActiveAt`.
   */
  async validateSession(sessionToken: string) {
    if (!sessionToken) return { valid: false, session: null };

    const session = await this.prisma.session.findUnique({
      where: { sessionToken },
    });

    if (!session) {
      return { valid: false, session: null, reason: "NOT_FOUND" };
    }

    if (session.isRevoked) {
      return { valid: false, session: null, reason: "REVOKED" };
    }

    if (new Date(session.expires).getTime() < Date.now()) {
      return { valid: false, session: null, reason: "EXPIRED" };
    }

    // Touch lastActiveAt if more than throttle duration has passed
    const now = Date.now();
    const lastActive = new Date(session.lastActiveAt || session.createdAt).getTime();
    const throttleMs = this.config.activityThrottleSeconds * 1000;

    if (now - lastActive > throttleMs) {
      // Fire and forget update (doesn't block critical path)
      this.prisma.session
        .update({
          where: { id: session.id },
          data: { lastActiveAt: new Date() },
        })
        .catch((err) => console.error("[SessionGuard] Failed to touch session:", err));
    }

    return { valid: true, session, reason: null };
  }

  /**
   * Fetches all active sessions for a user, formatted for the UI
   */
  async getUserSessions(
    userId: string,
    currentSessionTokenOrId?: string
  ): Promise<ActiveSessionDTO[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        expires: { gt: new Date() },
      },
      orderBy: { lastActiveAt: "desc" },
    });

    return sessions.map((s: any) => {
      const isCurrent =
        currentSessionTokenOrId !== undefined &&
        (s.sessionToken === currentSessionTokenOrId || s.id === currentSessionTokenOrId);

      return {
        id: s.id,
        isCurrent: Boolean(isCurrent),
        deviceType: (s.deviceType as any) || "desktop",
        browser: s.browser || "Unknown Browser",
        os: s.os || "Unknown OS",
        ipAddress: s.ipAddress || null,
        city: s.city || null,
        country: s.country || null,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        expires: s.expires,
      };
    });
  }

  /**
   * Revokes a specific session by ID
   */
  async revokeSession(options: RevokeSessionOptions): Promise<boolean> {
    const { sessionId, userId } = options;

    const result = await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        userId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    return result.count > 0;
  }

  /**
   * Revokes all other sessions of a user except the current active one
   */
  async revokeOtherSessions(options: RevokeOtherSessionsOptions): Promise<number> {
    const { userId, currentSessionId, currentSessionToken } = options;

    const whereClause: any = {
      userId,
      isRevoked: false,
    };

    if (currentSessionId) {
      whereClause.id = { not: currentSessionId };
    } else if (currentSessionToken) {
      whereClause.sessionToken = { not: currentSessionToken };
    }

    const result = await this.prisma.session.updateMany({
      where: whereClause,
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Revokes all sessions for a user (e.g. on password change)
   */
  async revokeAllSessions(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Enforces concurrent session limits by revoking the oldest active sessions
   */
  private async enforceConcurrentLimit(userId: string, maxSessions: number) {
    // Leave room for 1 new session: keep maxSessions - 1
    const allowedPrevious = Math.max(1, maxSessions - 1);

    const activeSessions = await this.prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        expires: { gt: new Date() },
      },
      orderBy: { lastActiveAt: "desc" },
    });

    if (activeSessions.length >= maxSessions) {
      // Find oldest sessions that exceed the limit
      const sessionsToRevoke = activeSessions.slice(allowedPrevious);
      const idsToRevoke = sessionsToRevoke.map((s: any) => s.id);

      if (idsToRevoke.length > 0) {
        await this.prisma.session.updateMany({
          where: { id: { in: idsToRevoke } },
          data: {
            isRevoked: true,
            revokedAt: new Date(),
          },
        });
      }
    }
  }

  /**
   * Generates a cryptographically strong session token
   */
  private generateSessionToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
}

