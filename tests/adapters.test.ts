import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryAdapter, createPrismaAdapter, createDrizzleAdapter } from "../src/core/adapters";

describe("Database Adapters", () => {
  describe("MemoryAdapter", () => {
    let adapter: ReturnType<typeof createMemoryAdapter>;

    beforeEach(() => {
      adapter = createMemoryAdapter();
    });

    it("should create, find, and update sessions", async () => {
      const session = await adapter.createSession({
        userId: "user_1",
        sessionToken: "token_123",
        browser: "Chrome",
        os: "Windows",
        expires: new Date(Date.now() + 86400000),
      });

      expect(session.id).toBeDefined();
      expect(session.userId).toBe("user_1");

      const found = await adapter.findSessionByToken("token_123");
      expect(found).not.toBeNull();
      expect(found?.browser).toBe("Chrome");

      const userSessions = await adapter.findSessionsByUserId("user_1");
      expect(userSessions.length).toBe(1);

      await adapter.updateSession(session.id, { browser: "Firefox" });
      const updated = await adapter.findSessionByToken("token_123");
      expect(updated?.browser).toBe("Firefox");
    });

    it("should revoke single session and other sessions", async () => {
      const s1 = await adapter.createSession({
        userId: "user_1",
        sessionToken: "token_1",
        expires: new Date(Date.now() + 86400000),
      });
      const s2 = await adapter.createSession({
        userId: "user_1",
        sessionToken: "token_2",
        expires: new Date(Date.now() + 86400000),
      });

      await adapter.revokeSession(s1.id);
      const found1 = await adapter.findSessionByToken("token_1");
      expect(found1?.isRevoked).toBe(true);

      const res = await adapter.revokeOtherSessions("user_1", s1.id);
      expect(res.count).toBe(1);
      const found2 = await adapter.findSessionByToken("token_2");
      expect(found2?.isRevoked).toBe(true);
    });

    it("should delete expired or revoked sessions with retention", async () => {
      const oldDate = new Date(Date.now() - 40 * 86400 * 1000);
      const recentDate = new Date();

      await adapter.createSession({
        userId: "user_1",
        sessionToken: "expired_token",
        expires: oldDate,
        lastActiveAt: oldDate,
      });

      await adapter.createSession({
        userId: "user_1",
        sessionToken: "active_token",
        expires: new Date(Date.now() + 86400000),
        lastActiveAt: recentDate,
      });

      const cleanupDate = new Date(Date.now() - 30 * 86400 * 1000);
      const res = await adapter.deleteExpiredOrRevoked(cleanupDate);
      expect(res.count).toBe(1);

      expect(await adapter.findSessionByToken("expired_token")).toBeNull();
      expect(await adapter.findSessionByToken("active_token")).not.toBeNull();
    });
  });

  describe("PrismaAdapter", () => {
    it("should delegate to prisma client methods", async () => {
      const mockPrisma = {
        session: {
          findUnique: async ({ where }: any) => ({ id: "1", sessionToken: where.sessionToken }),
          findMany: async ({ where }: any) => [{ id: "1", userId: where.userId }],
          create: async ({ data }: any) => ({ id: "created", ...data }),
          update: async ({ where, data }: any) => ({ id: where.id, ...data }),
          updateMany: async () => ({ count: 2 }),
          deleteMany: async () => ({ count: 5 }),
        },
      };

      const adapter = createPrismaAdapter(mockPrisma);

      const found = await adapter.findSessionByToken("test_token");
      expect(found?.sessionToken).toBe("test_token");

      const userSessions = await adapter.findSessionsByUserId("user_abc");
      expect(userSessions.length).toBe(1);

      const created = await adapter.createSession({ userId: "u1", sessionToken: "t1", expires: new Date() });
      expect(created.id).toBe("created");

      const othersRes = await adapter.revokeOtherSessions("u1", "s1");
      expect(othersRes.count).toBe(2);

      const delRes = await adapter.deleteExpiredOrRevoked(new Date());
      expect(delRes.count).toBe(5);
    });
  });

  describe("DrizzleAdapter", () => {
    it("should execute queries with drizzle query API or select", async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => [{ id: "drizzle_1", sessionToken: "drizzle_token" }],
            }),
          }),
        }),
        insert: () => ({
          values: (val: any) => ({
            returning: async () => [{ id: "inserted", ...val }],
          }),
        }),
        update: () => ({
          set: (val: any) => ({
            where: () => ({
              returning: async () => [{ id: "updated", ...val }],
            }),
          }),
        }),
        delete: () => ({
          where: async () => ({ rowCount: 3 }),
        }),
      };

      const fakeTable = { sessionToken: "sessionToken", userId: "userId", id: "id" };
      const adapter = createDrizzleAdapter(mockDb, fakeTable);

      const found = await adapter.findSessionByToken("drizzle_token");
      expect(found?.id).toBe("drizzle_1");

      const created = await adapter.createSession({ userId: "u1", sessionToken: "t1", expires: new Date() });
      expect(created.id).toBe("inserted");

      const deleted = await adapter.deleteExpiredOrRevoked(new Date());
      expect(deleted.count).toBe(3);
    });
  });
});
