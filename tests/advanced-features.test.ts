import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionManager } from "../src/core/session-manager";
import type { MinimalPrismaClient, CacheAdapter, SessionRevokedEvent } from "../src/core/types";

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

      findMany: vi.fn(async ({ where, orderBy, take, select }: any) => {
        let results = store.filter((s) => {
          if (where.userId && s.userId !== where.userId) return false;
          if (where.isRevoked !== undefined && s.isRevoked !== where.isRevoked) return false;
          if (where.expires?.gt && new Date(s.expires) <= new Date(where.expires.gt)) return false;
          if (where.expires?.lt && new Date(s.expires) >= new Date(where.expires.lt)) return false;
          if (where.id?.in && !where.id.in.includes(s.id)) return false;
          if (where.id?.not && s.id === where.id.not) return false;
          if (where.sessionToken?.not && s.sessionToken === where.sessionToken.not) return false;
          if (where.revokedAt?.lt && s.revokedAt && new Date(s.revokedAt) >= new Date(where.revokedAt.lt)) return false;

          // Handle OR clauses
          if (where.OR) {
            return where.OR.some((clause: any) => {
              let match = true;
              if (clause.isRevoked !== undefined && s.isRevoked !== clause.isRevoked) match = false;
              if (clause.revokedAt?.lt && s.revokedAt && new Date(s.revokedAt) >= new Date(clause.revokedAt.lt)) match = false;
              if (clause.revokedAt?.lt && !s.revokedAt && clause.isRevoked === true) match = false;
              if (clause.expires?.lt && new Date(s.expires) >= new Date(clause.expires.lt)) match = false;
              return match;
            });
          }

          return true;
        });

        if (orderBy?.lastActiveAt === "desc") {
          results.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
        }

        if (take) {
          results = results.slice(0, take);
        }

        if (select) {
          return results.map((s) => {
            const obj: any = {};
            for (const key of Object.keys(select)) {
              obj[key] = (s as any)[key];
            }
            return obj;
          });
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

      deleteMany: vi.fn(async ({ where }: any) => {
        if (where?.id?.in) {
          let count = 0;
          for (const id of where.id.in) {
            const idx = store.findIndex((s) => s.id === id);
            if (idx !== -1) {
              store.splice(idx, 1);
              count++;
            }
          }
          return { count };
        }
        return { count: 0 };
      }),
    },
  };
}

function createMockCache(): CacheAdapter & { _store: Map<string, boolean> } {
  const cacheStore = new Map<string, boolean>();
  return {
    _store: cacheStore,
    isBlacklisted: vi.fn(async (token: string) => cacheStore.has(token)),
    blacklist: vi.fn(async (token: string) => {
      cacheStore.set(token, true);
    }),
    removeFromBlacklist: vi.fn(async (token: string) => {
      cacheStore.delete(token);
    }),
  };
}

// ── Token Rotation Tests ────────────────────────────────────────────────

describe("Token Rotation", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let cache: ReturnType<typeof createMockCache>;

  beforeEach(() => {
    prisma = createMockPrisma();
    cache = createMockCache();
  });

  it("should rotate a valid session token", async () => {
    const manager = new SessionManager(prisma, { cacheAdapter: cache });

    const session = await manager.createSession({
      userId: "user1",
      sessionToken: "original-token",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });

    const result = await manager.rotateToken("original-token");

    expect(result).not.toBeNull();
    expect(result!.oldToken).toBe("original-token");
    expect(result!.newToken).not.toBe("original-token");
    expect(result!.newToken).toHaveLength(64); // 32 bytes as hex
    expect(result!.rotatedAt).toBeInstanceOf(Date);

    // Old token should be blacklisted in cache
    expect(cache.blacklist).toHaveBeenCalledWith("original-token");

    // Session in store should have new token
    const updated = prisma._store.find((s) => s.id === session.id);
    expect(updated!.sessionToken).toBe(result!.newToken);
  });

  it("should return null when rotating a non-existent token", async () => {
    const manager = new SessionManager(prisma);
    const result = await manager.rotateToken("non-existent-token");
    expect(result).toBeNull();
  });

  it("should return null when rotating a revoked session token", async () => {
    const manager = new SessionManager(prisma);

    await manager.createSession({
      userId: "user1",
      sessionToken: "revoked-token",
      userAgent: "Mozilla/5.0",
    });

    // Manually revoke
    prisma._store[0].isRevoked = true;

    const result = await manager.rotateToken("revoked-token");
    expect(result).toBeNull();
  });

  it("should auto-rotate token during validateSessionWithHijackProtection", async () => {
    const manager = new SessionManager(prisma, {
      tokenRotationIntervalSeconds: 0, // Rotate immediately
    });

    const session = await manager.createSession({
      userId: "user1",
      sessionToken: "auto-rotate-token",
      userAgent: "Mozilla/5.0",
    });

    // Set createdAt to the past so rotation triggers
    prisma._store[0].createdAt = new Date(Date.now() - 100_000);

    const result = await manager.validateSessionWithHijackProtection("auto-rotate-token");

    expect(result.valid).toBe(true);
    expect(result.rotatedToken).toBeDefined();
    expect(result.rotatedToken).not.toBe("auto-rotate-token");
  });
});

// ── Hijacking Protection Tests ──────────────────────────────────────────

describe("Hijacking Protection", () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  it("should detect hijack in strict mode (IP mismatch)", async () => {
    const onSessionRevoked = vi.fn();
    const manager = new SessionManager(prisma, {
      hijackingProtection: "strict",
      onSessionRevoked,
    });

    await manager.createSession({
      userId: "user1",
      sessionToken: "legit-token",
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0",
    });

    const result = await manager.validateSessionWithHijackProtection(
      "legit-token",
      "5.6.7.8" // Different IP → hijack
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("HIJACK_DETECTED");
    expect(onSessionRevoked).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "hijack_detected",
        sessionToken: "legit-token",
      })
    );
  });

  it("should allow same IP in strict mode", async () => {
    const manager = new SessionManager(prisma, {
      hijackingProtection: "strict",
    });

    await manager.createSession({
      userId: "user1",
      sessionToken: "same-ip-token",
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0",
    });

    const result = await manager.validateSessionWithHijackProtection(
      "same-ip-token",
      "1.2.3.4" // Same IP → OK
    );

    expect(result.valid).toBe(true);
  });

  it("should detect hijack in relaxed mode (country mismatch)", async () => {
    const manager = new SessionManager(prisma, {
      hijackingProtection: "relaxed",
    });

    const session = await manager.createSession({
      userId: "user1",
      sessionToken: "country-token",
      userAgent: "Mozilla/5.0",
    });

    // Set country on the session
    prisma._store[0].country = "US";

    const result = await manager.validateSessionWithHijackProtection(
      "country-token",
      undefined,
      "RU" // Different country → hijack
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("HIJACK_DETECTED");
  });

  it("should allow same country in relaxed mode (case insensitive)", async () => {
    const manager = new SessionManager(prisma, {
      hijackingProtection: "relaxed",
    });

    await manager.createSession({
      userId: "user1",
      sessionToken: "country-ok-token",
      userAgent: "Mozilla/5.0",
    });

    prisma._store[0].country = "US";

    const result = await manager.validateSessionWithHijackProtection(
      "country-ok-token",
      undefined,
      "us" // Same country, different case → OK
    );

    expect(result.valid).toBe(true);
  });

  it("should skip hijacking check when disabled", async () => {
    const manager = new SessionManager(prisma, {
      hijackingProtection: false,
    });

    await manager.createSession({
      userId: "user1",
      sessionToken: "no-protect-token",
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0",
    });

    const result = await manager.validateSessionWithHijackProtection(
      "no-protect-token",
      "5.6.7.8" // Different IP but protection is off
    );

    expect(result.valid).toBe(true);
  });
});

// ── Garbage Collector / Cleanup Tests ───────────────────────────────────

describe("Garbage Collector (cleanupExpiredSessions)", () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  function addOldSession(
    prisma: ReturnType<typeof createMockPrisma>,
    overrides: Partial<MockSession> = {}
  ) {
    const session: MockSession = {
      id: `sess_${Math.random().toString(36).slice(2, 10)}`,
      sessionToken: `token_${Math.random().toString(36).slice(2, 10)}`,
      userId: "user1",
      expires: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      ipAddress: null,
      userAgent: null,
      deviceType: "desktop",
      browser: "Chrome",
      os: "Windows",
      city: null,
      country: null,
      lastActiveAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      isRevoked: true,
      revokedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      ...overrides,
    };
    prisma._store.push(session);
    return session;
  }

  it("should clean up expired sessions with monthly schedule", async () => {
    const manager = new SessionManager(prisma);

    // Add 3 old revoked sessions (90 days old - older than 30-day monthly cutoff)
    addOldSession(prisma);
    addOldSession(prisma);
    addOldSession(prisma);

    // Add 1 active session (should NOT be deleted)
    await manager.createSession({
      userId: "user1",
      sessionToken: "active-token",
      userAgent: "Mozilla/5.0",
    });

    const result = await manager.cleanupExpiredSessions({ schedule: "monthly" });

    expect(result.schedule).toBe("monthly");
    expect(result.retentionDays).toBe(30);
    expect(result.deletedCount).toBe(3);
    expect(result.executedAt).toBeInstanceOf(Date);
  });

  it("should clean up with semi-annual schedule", async () => {
    const manager = new SessionManager(prisma);

    // Add sessions 200 days old (older than 180-day semi-annual cutoff)
    addOldSession(prisma, {
      revokedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
    });

    const result = await manager.cleanupExpiredSessions({ schedule: "semi-annual" });

    expect(result.schedule).toBe("semi-annual");
    expect(result.retentionDays).toBe(180);
    expect(result.deletedCount).toBe(1);
  });

  it("should clean up with annual schedule", async () => {
    const manager = new SessionManager(prisma);

    // Add session 400 days old (older than 365-day annual cutoff)
    addOldSession(prisma, {
      revokedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
      expires: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
    });

    // Add session 100 days old (should NOT be deleted with annual)
    addOldSession(prisma, {
      revokedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      expires: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    });

    const result = await manager.cleanupExpiredSessions({ schedule: "annual" });

    expect(result.schedule).toBe("annual");
    expect(result.retentionDays).toBe(365);
    expect(result.deletedCount).toBe(1);
  });

  it("should clean up with custom retention days", async () => {
    const manager = new SessionManager(prisma);

    addOldSession(prisma, {
      revokedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });

    const result = await manager.cleanupExpiredSessions({ retentionDays: 7 });

    expect(result.schedule).toBe("custom");
    expect(result.retentionDays).toBe(7);
    expect(result.deletedCount).toBe(1);
  });

  it("should only delete revoked sessions when revokedOnly is true", async () => {
    const manager = new SessionManager(prisma);

    // Add revoked session (old)
    addOldSession(prisma, { isRevoked: true });

    // Add expired but not revoked session (old)
    addOldSession(prisma, {
      isRevoked: false,
      revokedAt: null,
      expires: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    });

    const result = await manager.cleanupExpiredSessions({
      schedule: "monthly",
      revokedOnly: true,
    });

    expect(result.deletedCount).toBe(1); // Only the revoked one
  });

  it("should respect batch size limit", async () => {
    const manager = new SessionManager(prisma);

    for (let i = 0; i < 5; i++) {
      addOldSession(prisma);
    }

    const result = await manager.cleanupExpiredSessions({
      schedule: "monthly",
      batchSize: 2,
    });

    // Should only delete up to batchSize
    expect(result.deletedCount).toBeLessThanOrEqual(2);
  });

  it("should return 0 when no sessions to clean", async () => {
    const manager = new SessionManager(prisma);
    const result = await manager.cleanupExpiredSessions({ schedule: "monthly" });

    expect(result.deletedCount).toBe(0);
  });
});

// ── Session Revoked Event Tests ─────────────────────────────────────────

describe("Session Revoked Events (onSessionRevoked)", () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  it("should fire onSessionRevoked when a session is revoked", async () => {
    const onSessionRevoked = vi.fn();
    const manager = new SessionManager(prisma, { onSessionRevoked });

    const session = await manager.createSession({
      userId: "user1",
      sessionToken: "revoke-event-token",
      userAgent: "Mozilla/5.0",
    });

    await manager.revokeSession({ sessionId: session.id, userId: "user1" });

    expect(onSessionRevoked).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: session.id,
        userId: "user1",
        reason: "user_revoke",
      })
    );
  });

  it("should fire onSessionRevoked when all sessions are revoked", async () => {
    const onSessionRevoked = vi.fn();
    const manager = new SessionManager(prisma, { onSessionRevoked });

    await manager.createSession({
      userId: "user1",
      sessionToken: "token-1",
      userAgent: "Mozilla/5.0",
    });

    await manager.createSession({
      userId: "user1",
      sessionToken: "token-2",
      userAgent: "Mozilla/5.0",
    });

    await manager.revokeAllSessions("user1");

    expect(onSessionRevoked).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user1",
        reason: "all_revoked",
      })
    );
  });

  it("should handle async onSessionRevoked callbacks", async () => {
    const onSessionRevoked = vi.fn(async (event: SessionRevokedEvent) => {
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const manager = new SessionManager(prisma, { onSessionRevoked });

    const session = await manager.createSession({
      userId: "user1",
      sessionToken: "async-event-token",
      userAgent: "Mozilla/5.0",
    });

    await manager.revokeSession({ sessionId: session.id, userId: "user1" });

    expect(onSessionRevoked).toHaveBeenCalled();
  });

  it("should not crash when onSessionRevoked throws", async () => {
    const onSessionRevoked = vi.fn(() => {
      throw new Error("Callback error");
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const manager = new SessionManager(prisma, { onSessionRevoked });

    const session = await manager.createSession({
      userId: "user1",
      sessionToken: "error-event-token",
      userAgent: "Mozilla/5.0",
    });

    // Should not throw
    await expect(
      manager.revokeSession({ sessionId: session.id, userId: "user1" })
    ).resolves.toBe(true);

    consoleSpy.mockRestore();
  });

  it("should not fire when no sessions were actually revoked", async () => {
    const onSessionRevoked = vi.fn();
    const manager = new SessionManager(prisma, { onSessionRevoked });

    await manager.revokeSession({ sessionId: "non-existent", userId: "user1" });

    expect(onSessionRevoked).not.toHaveBeenCalled();
  });
});
