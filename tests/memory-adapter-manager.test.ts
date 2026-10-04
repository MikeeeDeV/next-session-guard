import { describe, it, expect } from "vitest";
import { SessionManager } from "../src/core/session-manager";
import { createMemoryAdapter } from "../src/core/adapters";

describe("SessionManager + in-memory adapter", () => {
  it("creates and validates a session", async () => {
    const sm = new SessionManager(createMemoryAdapter());
    const s = await sm.createSession({ userId: "u1", userAgent: "Mozilla/5.0 Chrome", ipAddress: "1.1.1.1" } as any);
    const res = await sm.validateSession(s.sessionToken);
    expect(res.valid).toBe(true);
  });

  it("revokes a session so it no longer validates", async () => {
    const sm = new SessionManager(createMemoryAdapter());
    const s = await sm.createSession({ userId: "u1" } as any);
    expect(await sm.revokeSession({ sessionId: s.id, userId: "u1" })).toBe(true);
    const res = await sm.validateSession(s.sessionToken);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("REVOKED");
  });

  it("lists only active sessions and revokes the others", async () => {
    const sm = new SessionManager(createMemoryAdapter());
    const a = await sm.createSession({ userId: "u1" } as any);
    await sm.createSession({ userId: "u1" } as any);
    await sm.createSession({ userId: "u2" } as any);
    expect((await sm.getUserSessions("u1", a.sessionToken)).length).toBe(2);
    const count = await sm.revokeOtherSessions({ userId: "u1", currentSessionToken: a.sessionToken });
    expect(count).toBe(1);
    expect((await sm.getUserSessions("u1")).length).toBe(1);
  });

  it("enforces maxConcurrentSessions", async () => {
    const sm = new SessionManager(createMemoryAdapter(), { maxConcurrentSessions: 2 });
    for (let i = 0; i < 4; i++) await sm.createSession({ userId: "u1" } as any);
    expect((await sm.getUserSessions("u1")).length).toBeLessThanOrEqual(2);
  });

  it("cleanup deletes old revoked sessions", async () => {
    const sm = new SessionManager(createMemoryAdapter());
    const s = await sm.createSession({ userId: "u1" } as any);
    await sm.revokeSession({ sessionId: s.id, userId: "u1" });
    const r = await sm.cleanupExpiredSessions({ retentionDays: -1 });
    expect(r.deletedCount).toBe(1);
  });
});