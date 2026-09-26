import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSessionActions } from "../src/actions/index";

// Mock helper to create in-memory store
function createMockPrisma() {
  const store: any[] = [];
  return {
    _store: store,
    session: {
      findUnique: vi.fn(),
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
        const item = {
          id: `sess_${Math.random().toString(36).slice(2, 9)}`,
          ...data,
          lastActiveAt: data.lastActiveAt || new Date(),
          createdAt: new Date(),
        };
        store.push(item);
        return item;
      }),
      update: vi.fn(),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const item of store) {
          let match = true;
          if (where.userId && item.userId !== where.userId) match = false;
          if (where.id && item.id !== where.id) match = false;
          if (where.sessionToken?.not && item.sessionToken === where.sessionToken.not) match = false;
          if (match) {
            Object.assign(item, data);
            count++;
          }
        }
        return { count };
      }),
    },
  };
}

describe("createSessionActions", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let currentUser: { id: string; sessionToken?: string } | null;

  beforeEach(() => {
    prisma = createMockPrisma();
    currentUser = { id: "user-123", sessionToken: "token-abc" };
  });

  function getActions(configOverrides = {}) {
    return createSessionActions({
      getPrisma: () => prisma,
      getCurrentUser: async () => currentUser,
      ...configOverrides,
    });
  }

  // ── getSessions ───────────────────────────────────────────

  describe("getSessions", () => {
    it("returns error when user is unauthorized", async () => {
      currentUser = null;
      const actions = getActions();

      const result = await actions.getSessions();
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("returns error when user has no ID", async () => {
      currentUser = { id: "" };
      const actions = getActions();

      const result = await actions.getSessions();
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("returns list of active sessions for the current user", async () => {
      await prisma.session.create({
        data: {
          userId: "user-123",
          sessionToken: "token-abc",
          expires: new Date(Date.now() + 100000),
          isRevoked: false,
          browser: "Chrome",
          os: "Windows",
          deviceType: "desktop",
        },
      });

      const actions = getActions();
      const result = await actions.getSessions();

      expect(result.error).toBeUndefined();
      expect(result.sessions).toBeDefined();
      expect(result.sessions?.length).toBe(1);
      expect(result.sessions![0].isCurrent).toBe(true);
      expect(result.sessions![0].browser).toBe("Chrome");
    });

    it("handles unexpected errors gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const actions = createSessionActions({
        getPrisma: () => {
          throw new Error("DB connection error");
        },
        getCurrentUser: async () => ({ id: "user-123" }),
      });

      const result = await actions.getSessions();
      expect(result).toEqual({ error: "Failed to retrieve active sessions" });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  // ── revokeSession ─────────────────────────────────────────

  describe("revokeSession", () => {
    it("returns error when unauthorized", async () => {
      currentUser = null;
      const actions = getActions();

      const result = await actions.revokeSession("sess-1");
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("returns error when sessionId is missing", async () => {
      const actions = getActions();

      const result = await actions.revokeSession("");
      expect(result).toEqual({ error: "Session ID is required" });
    });

    it("returns error when session is not found or already revoked", async () => {
      const actions = getActions();

      const result = await actions.revokeSession("non-existent-id");
      expect(result).toEqual({ error: "Session not found or already revoked" });
    });

    it("successfully revokes an active session", async () => {
      const created = await prisma.session.create({
        data: {
          userId: "user-123",
          sessionToken: "token-to-revoke",
          expires: new Date(Date.now() + 100000),
          isRevoked: false,
          browser: "Firefox",
          os: "Linux",
          deviceType: "desktop",
        },
      });

      const actions = getActions();
      const result = await actions.revokeSession(created.id);

      expect(result).toEqual({ success: true });
      expect(prisma._store[0].isRevoked).toBe(true);
    });

    it("handles unexpected errors gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const actions = createSessionActions({
        getPrisma: () => {
          throw new Error("DB error");
        },
        getCurrentUser: async () => ({ id: "user-123" }),
      });

      const result = await actions.revokeSession("sess-1");
      expect(result).toEqual({ error: "Failed to revoke session" });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  // ── revokeOtherSessions ───────────────────────────────────

  describe("revokeOtherSessions", () => {
    it("returns error when unauthorized", async () => {
      currentUser = null;
      const actions = getActions();

      const result = await actions.revokeOtherSessions();
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("revokes all other sessions of the user", async () => {
      await prisma.session.create({
        data: {
          userId: "user-123",
          sessionToken: "token-abc", // Current
          expires: new Date(Date.now() + 100000),
          isRevoked: false,
        },
      });
      await prisma.session.create({
        data: {
          userId: "user-123",
          sessionToken: "token-other-1",
          expires: new Date(Date.now() + 100000),
          isRevoked: false,
        },
      });
      await prisma.session.create({
        data: {
          userId: "user-123",
          sessionToken: "token-other-2",
          expires: new Date(Date.now() + 100000),
          isRevoked: false,
        },
      });

      const actions = getActions();
      const result = await actions.revokeOtherSessions();

      expect(result).toEqual({ success: true, revokedCount: 2 });
      expect(prisma._store.find((s) => s.sessionToken === "token-abc")?.isRevoked).toBe(false);
      expect(prisma._store.find((s) => s.sessionToken === "token-other-1")?.isRevoked).toBe(true);
      expect(prisma._store.find((s) => s.sessionToken === "token-other-2")?.isRevoked).toBe(true);
    });

    it("handles unexpected errors gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const actions = createSessionActions({
        getPrisma: () => {
          throw new Error("DB error");
        },
        getCurrentUser: async () => ({ id: "user-123" }),
      });

      const result = await actions.revokeOtherSessions();
      expect(result).toEqual({ error: "Failed to revoke other sessions" });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
