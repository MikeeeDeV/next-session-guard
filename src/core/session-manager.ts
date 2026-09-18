import {
  ActiveSessionDTO,
  CacheAdapter,
  CreateSessionOptions,
  MinimalPrismaClient,
  NewDeviceContext,
  RevokeOtherSessionsOptions,
  RevokeSessionOptions,
  SessionManagerConfig,
} from "./types";
import { getClientMetadata, parseClientInfo } from "./ua-parser";

export class SessionManager {
  private prisma: MinimalPrismaClient;
  private config: Required<
    Pick<SessionManagerConfig, "maxConcurrentSessions" | "sessionDurationDays" | "activityThrottleSeconds">
  > & {
    cacheAdapter?: CacheAdapter;
    geoProvider?: SessionManagerConfig["geoProvider"];
    onNewDeviceDetected?: SessionManagerConfig["onNewDeviceDetected"];
  };

  constructor(prismaClient: any, config?: SessionManagerConfig) {
    this.prisma = prismaClient as MinimalPrismaClient;
    this.config = {
      maxConcurrentSessions: config?.maxConcurrentSessions ?? 0, // 0 = unlimited
      sessionDurationDays: config?.sessionDurationDays ?? 30,
      activityThrottleSeconds: config?.activityThrottleSeconds ?? 300, // 5 minutes
      cacheAdapter: config?.cacheAdapter,
      geoProvider: config?.geoProvider,
      onNewDeviceDetected: config?.onNewDeviceDetected,
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
      city?: string;
      country?: string;
      rawUserAgent?: string;
    };

    if (options.req) {
      clientInfo = getClientMetadata(options.req);
    } else {
      clientInfo = parseClientInfo(options.userAgent, options.ipAddress);
    }

    // If no geo from headers and geoProvider is configured, attempt fallback
    if (!clientInfo.city && !clientInfo.country && clientInfo.ipAddress && this.config.geoProvider) {
      try {
        const geo = await this.config.geoProvider(clientInfo.ipAddress);
        if (geo) {
          clientInfo.city = geo.city;
          clientInfo.country = geo.country;
        }
      } catch (err) {
        console.error("[SessionGuard] geoProvider error:", err);
      }
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
        city: clientInfo.city || null,
        country: clientInfo.country || null,
        lastActiveAt: new Date(),
        isRevoked: false,
      },
    });

    // ── New Device Detection (fire-and-forget) ──────────────
    if (this.config.onNewDeviceDetected) {
      this.detectNewDevice(userId, clientInfo).catch((err) =>
        console.error("[SessionGuard] onNewDeviceDetected error:", err)
      );
    }

    return session;
  }

  /**
   * Validates whether a session is valid, active, and unrevoked.
   * Also automatically throttles and updates `lastActiveAt`.
   */
  async validateSession(sessionToken: string) {
    if (!sessionToken) return { valid: false, session: null };

    // Check cache blacklist first (sub-millisecond Edge check)
    if (this.config.cacheAdapter) {
      try {
        const isBlacklisted = await this.config.cacheAdapter.isBlacklisted(sessionToken);
        if (isBlacklisted) {
          return { valid: false, session: null, reason: "REVOKED" as const };
        }
      } catch (err) {
        console.error("[SessionGuard] Cache check error:", err);
        // Fall through to DB check
      }
    }

    const session = await this.prisma.session.findUnique({
      where: { sessionToken },
    });

    if (!session) {
      return { valid: false, session: null, reason: "NOT_FOUND" as const };
    }

    if (session.isRevoked) {
      // Also blacklist in cache for future fast lookups
      if (this.config.cacheAdapter) {
        this.config.cacheAdapter
          .blacklist(sessionToken)
          .catch((err) => console.error("[SessionGuard] Cache blacklist error:", err));
      }
      return { valid: false, session: null, reason: "REVOKED" as const };
    }

    if (new Date(session.expires).getTime() < Date.now()) {
      return { valid: false, session: null, reason: "EXPIRED" as const };
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

    // Get the session first to retrieve the token for cache blacklisting
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, isRevoked: false },
    });

    if (!session) return false;

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

    // Blacklist token in cache
    if (result.count > 0 && this.config.cacheAdapter && session.sessionToken) {
      this.config.cacheAdapter
        .blacklist(session.sessionToken)
        .catch((err) => console.error("[SessionGuard] Cache blacklist error:", err));
    }

    return result.count > 0;
  }

  /**
   * Revokes all other sessions of a user except the current active one
   */
  async revokeOtherSessions(options: RevokeOtherSessionsOptions): Promise<number> {
    const { userId, currentSessionId, currentSessionToken } = options;

    // Get sessions to revoke (for cache blacklisting)
    const whereClause: any = {
      userId,
      isRevoked: false,
    };

    if (currentSessionId) {
      whereClause.id = { not: currentSessionId };
    } else if (currentSessionToken) {
      whereClause.sessionToken = { not: currentSessionToken };
    }

    // Fetch tokens before revoking for cache blacklisting
    let tokensToBlacklist: string[] = [];
    if (this.config.cacheAdapter) {
      const sessionsToRevoke = await this.prisma.session.findMany({
        where: whereClause,
      });
      tokensToBlacklist = sessionsToRevoke
        .map((s: any) => s.sessionToken)
        .filter(Boolean);
    }

    const result = await this.prisma.session.updateMany({
      where: whereClause,
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    // Blacklist all revoked tokens in cache
    if (result.count > 0 && this.config.cacheAdapter && tokensToBlacklist.length > 0) {
      Promise.allSettled(
        tokensToBlacklist.map((token) => this.config.cacheAdapter!.blacklist(token))
      ).catch((err) => console.error("[SessionGuard] Cache blacklist error:", err));
    }

    return result.count;
  }

  /**
   * Revokes all sessions for a user (e.g. on password change)
   */
  async revokeAllSessions(userId: string): Promise<number> {
    // Fetch tokens before revoking for cache blacklisting
    let tokensToBlacklist: string[] = [];
    if (this.config.cacheAdapter) {
      const sessionsToRevoke = await this.prisma.session.findMany({
        where: { userId, isRevoked: false },
      });
      tokensToBlacklist = sessionsToRevoke
        .map((s: any) => s.sessionToken)
        .filter(Boolean);
    }

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

    // Blacklist all revoked tokens in cache
    if (result.count > 0 && this.config.cacheAdapter && tokensToBlacklist.length > 0) {
      Promise.allSettled(
        tokensToBlacklist.map((token) => this.config.cacheAdapter!.blacklist(token))
      ).catch((err) => console.error("[SessionGuard] Cache blacklist error:", err));
    }

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
      const tokensToBlacklist = sessionsToRevoke
        .map((s: any) => s.sessionToken)
        .filter(Boolean);

      if (idsToRevoke.length > 0) {
        await this.prisma.session.updateMany({
          where: { id: { in: idsToRevoke } },
          data: {
            isRevoked: true,
            revokedAt: new Date(),
          },
        });

        // Blacklist evicted tokens in cache
        if (this.config.cacheAdapter && tokensToBlacklist.length > 0) {
          Promise.allSettled(
            tokensToBlacklist.map((token: string) => this.config.cacheAdapter!.blacklist(token))
          ).catch((err) => console.error("[SessionGuard] Cache blacklist error:", err));
        }
      }
    }
  }

  /**
   * Detects if a login is from a new/unknown device and fires the callback
   */
  private async detectNewDevice(
    userId: string,
    newClientInfo: {
      browser: string;
      os: string;
      deviceType: string;
      ipAddress?: string;
      city?: string;
      country?: string;
    }
  ) {
    const existingSessions = await this.prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        expires: { gt: new Date() },
      },
      orderBy: { lastActiveAt: "desc" },
    });

    // Skip if this is the user's first session ever
    // (we compare against sessions excluding the just-created one)
    const previousSessions = existingSessions.filter(
      (s: any) =>
        s.browser !== newClientInfo.browser ||
        s.os !== newClientInfo.os ||
        s.ipAddress !== newClientInfo.ipAddress
    );

    if (existingSessions.length <= 1) return; // First session, no comparison needed

    const existingBrowsers = new Set(existingSessions.map((s: any) => s.browser).filter(Boolean));
    const existingOSs = new Set(existingSessions.map((s: any) => s.os).filter(Boolean));
    const existingIPs = new Set(existingSessions.map((s: any) => s.ipAddress).filter(Boolean));
    const existingCountries = new Set(existingSessions.map((s: any) => s.country).filter(Boolean));

    // Remove the just-created session's fingerprint to compare against historical
    existingBrowsers.delete(newClientInfo.browser);
    existingOSs.delete(newClientInfo.os);
    if (newClientInfo.ipAddress) existingIPs.delete(newClientInfo.ipAddress);
    if (newClientInfo.country) existingCountries.delete(newClientInfo.country);

    // Determine what's new
    const isNewBrowser = existingBrowsers.size > 0; // There ARE other browsers, meaning this one is different
    const isNewOS = existingOSs.size > 0;
    const isNewIP = newClientInfo.ipAddress ? existingIPs.size > 0 : false;
    const isNewLocation = newClientInfo.country ? existingCountries.size > 0 : false;

    // Only fire if something is actually new
    if (!isNewBrowser && !isNewOS && !isNewIP && !isNewLocation) return;

    const context: NewDeviceContext = {
      userId,
      newSession: {
        browser: newClientInfo.browser,
        os: newClientInfo.os,
        deviceType: newClientInfo.deviceType,
        ipAddress: newClientInfo.ipAddress,
        city: newClientInfo.city,
        country: newClientInfo.country,
      },
      isNewBrowser,
      isNewOS,
      isNewLocation,
      isNewIP,
      existingSessions: existingSessions.map((s: any) => ({
        browser: s.browser || "Unknown",
        os: s.os || "Unknown",
        ipAddress: s.ipAddress,
        city: s.city,
        country: s.country,
      })),
    };

    await this.config.onNewDeviceDetected!(context);
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
