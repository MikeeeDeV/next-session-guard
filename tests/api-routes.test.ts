import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSessionsRouteHandlers } from "../src/api/route-sessions";
import { createRevokeOthersHandler } from "../src/api/route-revoke-others";

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
      findMany: vi.fn(async ({ where }: any) => {
        return store.filter((s) => {
          if (where.userId && s.userId !== where.userId) return false;
          if (where.isRevoked !== undefined && s.isRevoked !== where.isRevoked) return false;
          if (where.expires?.gt && new Date(s.expires) <= new Date(where.expires.gt)) return false;
          if (where.sessionToken?.not && s.sessionToken === where.sessionToken.not) return false;
          return true;
        });
      }),
      create: vi.fn(async ({ data }: any) => {
        const item = {
          id: `sess_${Math.random().toString(36).slice(2, 9)}`,
          ...data,
          lastActiveAt: new Date(),
          createdAt: new Date(),
        };
        store.push(item);
        return item;
      }),
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

describe("App Router API Route Handlers", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let currentUser: { id: string; sessionToken?: string } | null;

  beforeEach(() => {
    prisma = createMockPrisma();
    currentUser = { id: "user-456", sessionToken: "token-current" };
  });

  // ── GET /api/sessions ─────────────────────────────────────

  describe("GET /api/sessions", () => {
    it("returns 401 when unauthorized", async () => {
      currentUser = null;
      const { GET } = createSessionsRouteHandlers(
        () => prisma,
        async () => currentUser
      );

      const req = new NextRequest("http://localhost:3000/api/sessions");
      const res = await GET(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ error: "Unauthorized" });
    });

    it("returns 200 and user sessions when authorized", async () => {
      await prisma.session.create({
        data: {
          userId: "user-456",
          sessionToken: "token-current",
          expires: new Date(Date.now() + 60000),
          isRevoked: false,
          browser: "Safari",
          os: "macOS",
          deviceType: "desktop",
        },
      });

      const { GET } = createSessionsRouteHandlers(
        () => prisma,
        async () => currentUser
      );

      const req = new NextRequest("http://localhost:3000/api/sessions");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.sessions).toHaveLength(1);
      expect(json.sessions[0].browser).toBe("Safari");
      expect(json.sessions[0].isCurrent).toBe(true);
    });

    it("returns 500 when an error is thrown", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { GET } = createSessionsRouteHandlers(
        () => {
          throw new Error("DB Crash");
        },
        async () => currentUser
      );

      const req = new NextRequest("http://localhost:3000/api/sessions");
      const res = await GET(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({ error: "Failed to retrieve active sessions" });
      consoleSpy.mockRestore();
    });
  });

  // ── DELETE /api/sessions?id=... ───────────────────────────

  describe("DELETE /api/sessions", () => {
    it("returns 401 when unauthorized", async () => {
      currentUser = null;
      const { DELETE } = createSessionsRouteHandlers(
        () => prisma,
        async () => currentUser
      );

      const req = new NextRequest("http://localhost:3000/api/sessions?id=123");
      const res = await DELETE(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ error: "Unauthorized" });
    });

    it("returns 400 when sessionId is missing", async () => {
      const { DELETE } = createSessionsRouteHandlers(
        () => prisma,
        async () => currentUser
      );

      const req = new NextRequest("http://localhost:3000/api/sessions");
      const res = await DELETE(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toEqual({ error: "Session ID is required" });
    });

    it("returns 404 when session not found or already revoked", async () => {
      const { DELETE } = createSessionsRouteHandlers(
        () => prisma,
        async () => currentUser
      );

      const req = new NextRequest("http://localhost:3000/api/sessions?id=non-existent");
      const res = await DELETE(req);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json).toEqual({ error: "Session not found or already revoked" });
    });

    it("returns 200 when session is revoked successfully", async () => {
      const created = await prisma.session.create({
        data: {
          userId: "user-456",
          sessionToken: "revoke-me",
          expires: new Date(Date.now() + 60000),
          isRevoked: false,
        },
      });

      const { DELETE } = createSessionsRouteHandlers(
        () => prisma,
        async () => currentUser
      );

      const req = new NextRequest(`http://localhost:3000/api/sessions?id=${created.id}`);
      const res = await DELETE(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ success: true });
      expect(prisma._store[0].isRevoked).toBe(true);
    });

    it("returns 500 when an error is thrown", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { DELETE } = createSessionsRouteHandlers(
        () => {
          throw new Error("Crash");
        },
        async () => currentUser
      );

      const req = new NextRequest("http://localhost:3000/api/sessions?id=sess-123");
      const res = await DELETE(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({ error: "Failed to revoke session" });
      consoleSpy.mockRestore();
    });
  });

  // ── POST /api/sessions/revoke-others ──────────────────────

  describe("POST /api/sessions/revoke-others", () => {
    it("returns 401 when unauthorized", async () => {
      currentUser = null;
      const POST = createRevokeOthersHandler(
        () => prisma,
        async () => currentUser
      );

      const req = new NextRequest("http://localhost:3000/api/sessions/revoke-others", {
        method: "POST",
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ error: "Unauthorized" });
    });

    it("successfully revokes other sessions and returns count", async () => {
      await prisma.session.create({
        data: {
          userId: "user-456",
          sessionToken: "token-current",
          expires: new Date(Date.now() + 60000),
          isRevoked: false,
        },
      });
      await prisma.session.create({
        data: {
          userId: "user-456",
          sessionToken: "token-old",
          expires: new Date(Date.now() + 60000),
          isRevoked: false,
        },
      });

      const POST = createRevokeOthersHandler(
        () => prisma,
        async () => currentUser
      );

      const req = new NextRequest("http://localhost:3000/api/sessions/revoke-others", {
        method: "POST",
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.revokedCount).toBe(1);
      expect(json.message).toContain("Successfully signed out from 1 other session(s).");
    });

    it("returns 500 when error is thrown", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const POST = createRevokeOthersHandler(
        () => {
          throw new Error("DB fail");
        },
        async () => currentUser
      );

      const req = new NextRequest("http://localhost:3000/api/sessions/revoke-others", {
        method: "POST",
      });
      const res = await POST(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({ error: "Failed to revoke other sessions" });
      consoleSpy.mockRestore();
    });
  });
});
