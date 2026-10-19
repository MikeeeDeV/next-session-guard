import type { MinimalPrismaClient } from "./types";

/**
 * Universal Database Adapter interface for Next-Session-Guard.
 * Enables zero-friction support for Prisma, Drizzle ORM, Supabase,
 * Kysely, or In-Memory storage.
 */
export interface DatabaseAdapter {
  findSessionByToken(token: string): Promise<any | null>;
  findSessionsByUserId(userId: string): Promise<any[]>;
  createSession(data: {
    userId: string;
    sessionToken: string;
    deviceType?: string;
    browser?: string;
    os?: string;
    ipAddress?: string | null;
    city?: string | null;
    country?: string | null;
    userAgent?: string | null;
    expires: Date;
    createdAt?: Date;
    lastActiveAt?: Date;
    isRevoked?: boolean;
  }): Promise<any>;
  updateSession(id: string, data: Partial<{
    sessionToken: string;
    lastActiveAt: Date;
    isRevoked: boolean;
    expires: Date;
  }>): Promise<any>;
  revokeSession(id: string): Promise<any>;
  revokeOtherSessions(userId: string, keepSessionId: string): Promise<{ count: number }>;
  deleteExpiredOrRevoked(olderThan: Date, revokedOnly?: boolean, batchSize?: number): Promise<{ count: number }>;
}

/**
 * Prisma ORM Adapter
 */
export function createPrismaAdapter(prisma: MinimalPrismaClient | any): DatabaseAdapter {
  return {
    async findSessionByToken(token: string) {
      return prisma.session.findUnique({
        where: { sessionToken: token },
      });
    },

    async findSessionsByUserId(userId: string) {
      return prisma.session.findMany({
        where: { userId },
        orderBy: { lastActiveAt: "desc" },
      });
    },

    async createSession(data: any) {
      return prisma.session.create({
        data,
      });
    },

    async updateSession(id: string, data: any) {
      return prisma.session.update({
        where: { id },
        data,
      });
    },

    async revokeSession(id: string) {
      return prisma.session.update({
        where: { id },
        data: { isRevoked: true },
      });
    },

    async revokeOtherSessions(userId: string, keepSessionId: string) {
      const res = await prisma.session.updateMany({
        where: {
          userId,
          id: { not: keepSessionId },
          isRevoked: false,
        },
        data: { isRevoked: true },
      });
      return { count: res?.count ?? 0 };
    },

    async deleteExpiredOrRevoked(olderThan: Date, revokedOnly = false, batchSize = 10000) {
      const whereClause: any = revokedOnly
        ? { isRevoked: true, lastActiveAt: { lt: olderThan } }
        : {
            OR: [
              { isRevoked: true, lastActiveAt: { lt: olderThan } },
              { expires: { lt: olderThan } },
            ],
          };

      // If batchSize is specified and supported, delete by IDs
      if (batchSize && batchSize > 0) {
        const toDelete = await prisma.session.findMany({
          where: whereClause,
          select: { id: true },
          take: batchSize,
        });

        if (!toDelete || toDelete.length === 0) {
          return { count: 0 };
        }

        const ids = toDelete.map((s: any) => s.id);
        const res = await prisma.session.deleteMany({
          where: { id: { in: ids } },
        });
        return { count: res?.count ?? ids.length };
      }

      const res = await prisma.session.deleteMany({
        where: whereClause,
      });
      return { count: res?.count ?? 0 };
    },
  };
}

/**
 * High-performance In-Memory Database Adapter for testing,
 * edge microservices, and rapid playground evaluation.
 */
export function createMemoryAdapter(): DatabaseAdapter & { _store: any[]; session: any } {
  const store: any[] = [];

  return {
    _store: store,

    async findSessionByToken(token: string) {
      const session = store.find((s) => s.sessionToken === token);
      return session ? { ...session } : null;
    },

    async findSessionsByUserId(userId: string) {
      return store
        .filter((s) => s.userId === userId)
        .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
        .map((s) => ({ ...s }));
    },

    async createSession(data: any) {
      const newSession = {
        id: data.id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        createdAt: data.createdAt || new Date(),
        lastActiveAt: data.lastActiveAt || new Date(),
        isRevoked: false,
        ...data,
      };
      store.push(newSession);
      return { ...newSession };
    },

    async updateSession(id: string, data: any) {
      const idx = store.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      store[idx] = { ...store[idx], ...data };
      return { ...store[idx] };
    },

    async revokeSession(id: string) {
      const idx = store.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      store[idx].isRevoked = true;
      return { ...store[idx] };
    },

    async revokeOtherSessions(userId: string, keepSessionId: string) {
      let count = 0;
      for (const s of store) {
        if (s.userId === userId && s.id !== keepSessionId && !s.isRevoked) {
          s.isRevoked = true;
          count++;
        }
      }
      return { count };
    },

    async deleteExpiredOrRevoked(olderThan: Date, revokedOnly = false, batchSize = 10000) {
      let deleted = 0;
      const olderThanMs = olderThan.getTime();

      for (let i = store.length - 1; i >= 0; i--) {
        if (batchSize && deleted >= batchSize) break;
        const s = store[i];
        const lastActiveMs = new Date(s.lastActiveAt).getTime();
        const expiresMs = new Date(s.expires).getTime();

        const shouldDelete = revokedOnly
          ? s.isRevoked && lastActiveMs < olderThanMs
          : (s.isRevoked && lastActiveMs < olderThanMs) || expiresMs < olderThanMs;

        if (shouldDelete) {
          store.splice(i, 1);
          deleted++;
        }
      }

      return { count: deleted };
    },

    // Prisma-compatible interface for direct SessionManager instantiation
    session: {
      async findUnique({ where }: any) {
        if (where?.sessionToken) {
          const s = store.find((item) => item.sessionToken === where.sessionToken);
          return s ? { ...s } : null;
        }
        if (where?.id) {
          const s = store.find((item) => item.id === where.id);
          return s ? { ...s } : null;
        }
        return null;
      },
      async findFirst({ where }: any) {
        const s = store.find((item) => {
          if (where.id && item.id !== where.id) return false;
          if (where.userId && item.userId !== where.userId) return false;
          if (where.isRevoked !== undefined && item.isRevoked !== where.isRevoked) return false;
          return true;
        });
        return s ? { ...s } : null;
      },
      async findMany({ where, orderBy }: any = {}) {
        let results = store.filter((s) => {
          if (!where) return true;
          if (where.userId && s.userId !== where.userId) return false;
          if (where.isRevoked !== undefined && s.isRevoked !== where.isRevoked) return false;
          if (where.expires?.gt && new Date(s.expires) <= new Date(where.expires.gt)) return false;
          if (where.id?.in && !where.id.in.includes(s.id)) return false;
          if (where.id?.not && s.id === where.id.not) return false;
          if (where.sessionToken?.not && s.sessionToken === where.sessionToken.not) return false;
          return true;
        });
        if (orderBy?.lastActiveAt === "desc") {
          results.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
        }
        return results.map((s) => ({ ...s }));
      },
      async create({ data }: any) {
        const newSession = {
          id: data.id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          createdAt: data.createdAt || new Date(),
          lastActiveAt: data.lastActiveAt || new Date(),
          isRevoked: false,
          ...data,
        };
        store.push(newSession);
        return { ...newSession };
      },
      async update({ where, data }: any) {
        const idx = store.findIndex((s) => s.id === where.id || s.sessionToken === where.sessionToken);
        if (idx === -1) return null;
        store[idx] = { ...store[idx], ...data };
        return { ...store[idx] };
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const s of store) {
          if (where.id?.in && !where.id.in.includes(s.id)) continue;
          if (where.id && s.id !== where.id) continue;
          if (where.userId && s.userId !== where.userId) continue;
          if (where.isRevoked !== undefined && s.isRevoked !== where.isRevoked) continue;
          if (where.sessionToken?.not && s.sessionToken === where.sessionToken.not) continue;
          Object.assign(s, data);
          count++;
        }
        return { count };
      },
      async deleteMany({ where }: any = {}) {
        let count = 0;
        for (let i = store.length - 1; i >= 0; i--) {
          const s = store[i];
          if (where.id?.in && !where.id.in.includes(s.id)) continue;
          if (where.userId && s.userId !== where.userId) continue;
          store.splice(i, 1);
          count++;
        }
        return { count };
      },
    },
  };
}

/**
 * Generic Drizzle ORM Adapter Factory
 * Allows passing Drizzle db instance and sessions table definition
 *
 * @example
 * ```typescript
 * import { db } from "@/db";
 * import { sessions } from "@/db/schema";
 * const adapter = createDrizzleAdapter(db, sessions);
 * const sessionManager = new SessionManager(adapter);
 * ```
 */
export function createDrizzleAdapter(drizzleDb: any, sessionsTable: any): DatabaseAdapter {
  return {
    async findSessionByToken(token: string) {
      // Handles Drizzle query: db.select().from(sessionsTable).where(eq(sessionsTable.sessionToken, token))
      if (drizzleDb.query?.sessions?.findFirst) {
        return drizzleDb.query.sessions.findFirst({
          where: (fields: any, { eq }: any) => eq(fields.sessionToken, token),
        });
      }
      const rows = await drizzleDb.select().from(sessionsTable).where((t: any, { eq }: any) => eq(t.sessionToken, token)).limit(1);
      return rows[0] || null;
    },

    async findSessionsByUserId(userId: string) {
      if (drizzleDb.query?.sessions?.findMany) {
        return drizzleDb.query.sessions.findMany({
          where: (fields: any, { eq }: any) => eq(fields.userId, userId),
        });
      }
      return drizzleDb.select().from(sessionsTable).where((t: any, { eq }: any) => eq(t.userId, userId));
    },

    async createSession(data: any) {
      const res = await drizzleDb.insert(sessionsTable).values(data).returning();
      return Array.isArray(res) ? res[0] : res;
    },

    async updateSession(id: string, data: any) {
      const res = await drizzleDb.update(sessionsTable).set(data).where((t: any, { eq }: any) => eq(t.id, id)).returning();
      return Array.isArray(res) ? res[0] : res;
    },

    async revokeSession(id: string) {
      const res = await drizzleDb.update(sessionsTable).set({ isRevoked: true }).where((t: any, { eq }: any) => eq(t.id, id)).returning();
      return Array.isArray(res) ? res[0] : res;
    },

    async revokeOtherSessions(userId: string, keepSessionId: string) {
      const res = await drizzleDb.update(sessionsTable)
        .set({ isRevoked: true })
        .where((t: any, { and, eq, ne, not }: any) => and(
          eq(t.userId, userId),
          ne(t.id, keepSessionId),
          eq(t.isRevoked, false)
        ));
      return { count: res?.rowCount ?? res?.length ?? 1 };
    },

    async deleteExpiredOrRevoked(olderThan: Date, revokedOnly = false) {
      const res = await drizzleDb.delete(sessionsTable).where((t: any, { or, and, eq, lt }: any) => {
        if (revokedOnly) {
          return and(eq(t.isRevoked, true), lt(t.lastActiveAt, olderThan));
        }
        return or(
          and(eq(t.isRevoked, true), lt(t.lastActiveAt, olderThan)),
          lt(t.expires, olderThan)
        );
      });
      return { count: res?.rowCount ?? res?.length ?? 0 };
    },
  };
}
