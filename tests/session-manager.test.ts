import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionManager } from "../src/core/session-manager";
import type { MinimalPrismaClient, CacheAdapter } from "../src/core/types";

// ── Mock Prisma Client ────────────────────────────────────────────────────────

interface MockSession {
  id: string;
  sessionToken: string;
  userId: string;
  expires: Date;
  ipAddress: string | null;
  userAgent: string | null;
  deviceType: string;
  browser: string;
  os: string;
  city: string | null;
  country: string | null;
  lastActiveAt: Date;
  isRevoked: boolean;
  revokedAt: Date | null;
  createdAt: Date;
}

function createMockPrisma(): MinimalPrismaClient & { _store: MockSession[] } {
  const store: MockSession[] = [];

  return {
    _store: store,
    session: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.sessionToken) {
          return store.find((s) => s.sessionToken === where.sessionToken) || null;
        }
        if (where.id) {
          return store.find((s) => s.id === where.id) || null;
        }
        return null;
      }),

      findFirst: vi.fn(async ({ where }: any) => {
        return (
          store.find((s) => {
            if (where.id && s.id !== where.id) return false;
            if (where.userId && s.userId !== where.userId) return false;
            if (where.isRevoked !== undefined && s.isRevoked !== where.isRevoked) return false;
            return true;
          }) || null
        );
      }),

      findMany: vi.fn(async ({ where, orderBy }: any) => {
        let results = store.filter((s) => {
          if (where.userId && s.userId !== where.userId) return false;
          if (where.isRevoked !== undefined && s.isRevoked !== where.isRevoked) return false;
          if (where.expires?.gt && new Date(s.expires) <= new Date(where.expires.gt)) return false;
          if (where.id?.in && !where.id.in.includes(s.id)) return false;
          if (where.id?.not && s.id === where.id.not) return false;
          if (where.sessionToken?.not && s.sessionToken === where.sessionToken.not) return false;
          return true;
        });

        if (orderBy?.lastActiveAt === "desc") {
          results.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
        }

        return results;
      }),

      create: vi.fn(async ({ data }: any) => {
        const session: MockSession = {
          id: `sess_${Math.random().toString(36).slice(2, 10)}`,
          sessionToken: data.sessionToken,
          userId: data.userId,
          expires: new Date(data.expires),
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
          deviceType: data.deviceType || "desktop",
          browser: data.browser || "Unknown Browser",
          os: data.os || "Unknown OS",
          city: data.city || null,
          country: data.country || null,
          lastActiveAt: data.lastActiveAt || new Date(),
          isRevoked: data.isRevoked || false,
          revokedAt: data.revokedAt || null,
          createdAt: new Date(),
        };
        store.push(session);
        return session;
      }),

      update: vi.fn(async ({ where, data }: any) => {
        const session = store.find((s) => s.id === where.id);
        if (session) {
          Object.assign(session, data);
        }
        return session;
      }),

      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const session of store) {
          let matches = true;
          if (where.userId && session.userId !== where.userId) matches = false;
          if (where.isRevoked !== undefined && session.isRevoked !== where.isRevoked) matches = false;
          if (where.id) {
            if (typeof where.id === "string" && session.id !== where.id) matches = false;
            if (where.id.in && !where.id.in.includes(session.id)) matches = false;
            if (where.id.not && session.id === where.id.not) matches = false;
          }
          if (where.sessionToken?.not && session.sessionToken === where.sessionToken.not) matches = false;

          if (matches) {
            Object.assign(session, data);
            count++;
          }
        }
        return { count };
      }),

      delete: vi.fn(async ({ where }: any) => {
        const idx = store.findIndex((s) => s.id === where.id);
        if (idx !== -1) return store.splice(idx, 1)[0];
        return null;
      }),

      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  };
}

// ── SessionManager Tests ──────────────────────────────────────────────────────

describe("SessionManager", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let manager: SessionManager;

  beforeEach(() => {
    prisma = createMockPrisma();
    manager = new SessionManager(prisma);
  });

  // ── createSession ─────────────────────────────────────────

  describe("createSession", () => {
    it("creates a session with correct metadata", async () => {
      const session = await manager.createSession({
        userId: "user-1",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        ipAddress: "1.2.3.4",
      });

      expect(session).toBeDefined();
      expect(session.userId).toBe("user-1");
      expect(session.browser).toBe("Chrome");
      expect(session.os).toBe("Windows 10/11");
      expect(session.deviceType).toBe("desktop");
      expect(session.ipAddress).toBe("1.2.3.4");
      expect(session.isRevoked).toBe(false);
    });

    it("generates a session token when not provided", async () => {
      const session = await manager.createSession({
        userId: "user-1",
      });

      expect(session.sessionToken).toBeDefined();
      expect(session.sessionToken.length).toBe(64); // 32 bytes as hex
    });

    it("uses provided session token", async () => {
      const session = await manager.createSession({
        userId: "user-1",
        sessionToken: "my-custom-token",
      });

      expect(session.sessionToken).toBe("my-custom-token");
    });

    it("uses provided expiresAt", async () => {
      const customExpiry = new Date("2030-01-01");
      const session = await manager.createSession({
        userId: "user-1",
        expiresAt: customExpiry,
      });

      expect(session.expires.getTime()).toBe(customExpiry.getTime());
    });

    it("stores geo data from geoProvider", async () => {
      const geoManager = new SessionManager(prisma, {
        geoProvider: async (ip) => ({ city: "Cairo", country: "EG" }),
      });

      const session = await geoManager.createSession({
        userId: "user-1",
        ipAddress: "1.2.3.4",
      });

      expect(session.city).toBe("Cairo");
      expect(session.country).toBe("EG");
    });
  });

  // ── validateSession ───────────────────────────────────────

  describe("validateSession", () => {
    it("returns valid for active session", async () => {
      await manager.createSession({
        userId: "user-1",
        sessionToken: "valid-token",
      });

      const result = await manager.validateSession("valid-token");
      expect(result.valid).toBe(true);
      expect(result.reason).toBeNull();
    });

    it("returns invalid for non-existent token", async () => {
      const result = await manager.validateSession("non-existent");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("NOT_FOUND");
    });

    it("returns invalid for revoked session", async () => {
      await manager.createSession({
        userId: "user-1",
        sessionToken: "revoked-token",
      });

      await manager.revokeSession({
        sessionId: prisma._store[0].id,
        userId: "user-1",
      });

      const result = await manager.validateSession("revoked-token");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("REVOKED");
    });

    it("returns invalid for expired session", async () => {
      await manager.createSession({
        userId: "user-1",
        sessionToken: "expired-token",
        expiresAt: new Date(Date.now() - 1000), // Already expired
      });

      const result = await manager.validateSession("expired-token");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("EXPIRED");
    });

    it("returns invalid for empty token", async () => {
      const result = await manager.validateSession("");
      expect(result.valid).toBe(false);
    });
  });

  // ── enforceConcurrentLimit ────────────────────────────────

  describe("maxConcurrentSessions", () => {
    it("revokes oldest session when limit exceeded", async () => {
      const limitedManager = new SessionManager(prisma, {
        maxConcurrentSessions: 2,
      });

      // Create 2 sessions (at the limit)
      const session1 = await limitedManager.createSession({
        userId: "user-1",
        sessionToken: "token-oldest",
      });

      // Add delay to ensure ordering
      prisma._store[0].lastActiveAt = new Date(Date.now() - 10000);

      const session2 = await limitedManager.createSession({
        userId: "user-1",
        sessionToken: "token-middle",
      });

      // Now create a 3rd session — should revoke the oldest
      const session3 = await limitedManager.createSession({
        userId: "user-1",
        sessionToken: "token-newest",
      });

      // The oldest session should be revoked
      const oldestSession = prisma._store.find((s) => s.sessionToken === "token-oldest");
      expect(oldestSession?.isRevoked).toBe(true);

      // The newer sessions should be active
      const validate2 = await limitedManager.validateSession("token-middle");
      expect(validate2.valid).toBe(true);
    });

    it("does not revoke when under limit", async () => {
      const limitedManager = new SessionManager(prisma, {
        maxConcurrentSessions: 5,
      });

      await limitedManager.createSession({ userId: "user-1", sessionToken: "t1" });
      await limitedManager.createSession({ userId: "user-1", sessionToken: "t2" });

      const allActive = prisma._store.filter((s) => !s.isRevoked);
      expect(allActive.length).toBe(2);
    });

    it("does not enforce when maxConcurrentSessions is 0 (unlimited)", async () => {
      const unlimitedManager = new SessionManager(prisma, {
        maxConcurrentSessions: 0,
      });

      for (let i = 0; i < 10; i++) {
        await unlimitedManager.createSession({ userId: "user-1", sessionToken: `t${i}` });
      }

      const allActive = prisma._store.filter((s) => !s.isRevoked);
      expect(allActive.length).toBe(10);
    });
  });

  // ── revokeSession ─────────────────────────────────────────

  describe("revokeSession", () => {
    it("revokes a specific session", async () => {
      const session = await manager.createSession({
        userId: "user-1",
        sessionToken: "to-revoke",
      });

      const success = await manager.revokeSession({
        sessionId: session.id,
        userId: "user-1",
      });

      expect(success).toBe(true);
      expect(prisma._store[0].isRevoked).toBe(true);
      expect(prisma._store[0].revokedAt).toBeDefined();
    });

    it("returns false when session not found", async () => {
      const success = await manager.revokeSession({
        sessionId: "non-existent",
        userId: "user-1",
      });

      expect(success).toBe(false);
    });

    it("prevents revoking another user's session", async () => {
      const session = await manager.createSession({
        userId: "user-1",
        sessionToken: "user1-token",
      });

      const success = await manager.revokeSession({
        sessionId: session.id,
        userId: "user-2", // Different user
      });

      expect(success).toBe(false);
    });
  });

  // ── revokeOtherSessions ───────────────────────────────────

  describe("revokeOtherSessions", () => {
    it("revokes all except the current session", async () => {
      await manager.createSession({ userId: "user-1", sessionToken: "keep-this" });
      await manager.createSession({ userId: "user-1", sessionToken: "revoke-1" });
      await manager.createSession({ userId: "user-1", sessionToken: "revoke-2" });

      const count = await manager.revokeOtherSessions({
        userId: "user-1",
        currentSessionToken: "keep-this",
      });

      expect(count).toBe(2);
      const current = prisma._store.find((s) => s.sessionToken === "keep-this");
      expect(current?.isRevoked).toBe(false);
    });

    it("returns 0 when no other sessions exist", async () => {
      await manager.createSession({ userId: "user-1", sessionToken: "only-one" });

      const count = await manager.revokeOtherSessions({
        userId: "user-1",
        currentSessionToken: "only-one",
      });

      expect(count).toBe(0);
    });
  });

  // ── revokeAllSessions ─────────────────────────────────────

  describe("revokeAllSessions", () => {
    it("revokes all sessions for a user", async () => {
      await manager.createSession({ userId: "user-1", sessionToken: "t1" });
      await manager.createSession({ userId: "user-1", sessionToken: "t2" });
      await manager.createSession({ userId: "user-2", sessionToken: "t3" }); // Different user

      const count = await manager.revokeAllSessions("user-1");

      expect(count).toBe(2);
      const user1Sessions = prisma._store.filter((s) => s.userId === "user-1");
      expect(user1Sessions.every((s) => s.isRevoked)).toBe(true);

      // User 2's session should be unaffected
      const user2Session = prisma._store.find((s) => s.userId === "user-2");
      expect(user2Session?.isRevoked).toBe(false);
    });
  });

  // ── getUserSessions ───────────────────────────────────────

  describe("getUserSessions", () => {
    it("returns only active sessions", async () => {
      await manager.createSession({ userId: "user-1", sessionToken: "active" });
      await manager.createSession({ userId: "user-1", sessionToken: "to-revoke" });

      // Revoke one
      const toRevoke = prisma._store.find((s) => s.sessionToken === "to-revoke")!;
      await manager.revokeSession({ sessionId: toRevoke.id, userId: "user-1" });

      const sessions = await manager.getUserSessions("user-1");
      expect(sessions.length).toBe(1);
      expect(sessions[0].isCurrent).toBe(false);
    });

    it("marks the current session correctly", async () => {
      await manager.createSession({ userId: "user-1", sessionToken: "current-token" });
      await manager.createSession({ userId: "user-1", sessionToken: "other-token" });

      const sessions = await manager.getUserSessions("user-1", "current-token");
      const current = sessions.find((s) => s.isCurrent);
      expect(current).toBeDefined();
    });

    it("includes geo data in DTO", async () => {
      const geoManager = new SessionManager(prisma, {
        geoProvider: async () => ({ city: "Cairo", country: "EG" }),
      });

      await geoManager.createSession({ userId: "user-1", ipAddress: "1.2.3.4" });
      const sessions = await geoManager.getUserSessions("user-1");

      expect(sessions[0].city).toBe("Cairo");
      expect(sessions[0].country).toBe("EG");
    });
  });

  // ── Cache Integration ─────────────────────────────────────

  describe("cache integration", () => {
    it("blacklists token on revoke", async () => {
      const mockCache: CacheAdapter = {
        isBlacklisted: vi.fn(async () => false),
        blacklist: vi.fn(async () => {}),
        removeFromBlacklist: vi.fn(async () => {}),
      };

      const cachedManager = new SessionManager(prisma, {
        cacheAdapter: mockCache,
      });

      const session = await cachedManager.createSession({
        userId: "user-1",
        sessionToken: "cached-token",
      });

      await cachedManager.revokeSession({
        sessionId: session.id,
        userId: "user-1",
      });

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 50));

      expect(mockCache.blacklist).toHaveBeenCalledWith("cached-token");
    });

    it("checks cache before DB on validate", async () => {
      const mockCache: CacheAdapter = {
        isBlacklisted: vi.fn(async () => true), // Blacklisted!
        blacklist: vi.fn(async () => {}),
        removeFromBlacklist: vi.fn(async () => {}),
      };

      const cachedManager = new SessionManager(prisma, {
        cacheAdapter: mockCache,
      });

      await cachedManager.createSession({
        userId: "user-1",
        sessionToken: "blacklisted-token",
      });

      const result = await cachedManager.validateSession("blacklisted-token");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("REVOKED");
      expect(mockCache.isBlacklisted).toHaveBeenCalledWith("blacklisted-token");
    });
  });

  // ── New Device Detection ──────────────────────────────────

  describe("onNewDeviceDetected", () => {
    it("fires callback when new browser is detected", async () => {
      const callback = vi.fn();
      const alertManager = new SessionManager(prisma, {
        onNewDeviceDetected: callback,
      });

      // First session — Chrome
      await alertManager.createSession({
        userId: "user-1",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      });

      // Second session — Firefox (different browser!)
      await alertManager.createSession({
        userId: "user-1",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
      });

      // Wait for async fire-and-forget
      await new Promise((r) => setTimeout(r, 100));

      expect(callback).toHaveBeenCalled();
      const ctx = callback.mock.calls[0][0];
      expect(ctx.userId).toBe("user-1");
      expect(ctx.newSession.browser).toBe("Firefox");
      expect(ctx.isNewBrowser).toBe(true);
    });

    it("does not fire for first-ever session", async () => {
      const callback = vi.fn();
      const alertManager = new SessionManager(prisma, {
        onNewDeviceDetected: callback,
      });

      await alertManager.createSession({
        userId: "user-1",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      });

      await new Promise((r) => setTimeout(r, 100));
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
