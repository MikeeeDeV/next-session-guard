/**
 * next-session-guard/cache
 *
 * Edge-compatible cache adapters for sub-millisecond token blacklist checks.
 * Import from "next-session-guard/cache"
 */

import type { CacheAdapter } from "../core/types";

export type { CacheAdapter };

// ── In-Memory Adapter ───────────────────────────────────────────────────────────
// Suitable for development, testing, and single-instance deployments.

/**
 * Creates an in-memory cache adapter using a Map.
 * Tokens are automatically cleaned up after their TTL expires.
 *
 * @example
 * ```ts
 * import { createMemoryAdapter } from "next-session-guard/cache";
 * const cache = createMemoryAdapter();
 * ```
 */
export function createMemoryAdapter(): CacheAdapter {
  const store = new Map<string, { expiresAt: number }>();

  // Periodic cleanup every 60 seconds
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store) {
      if (value.expiresAt <= now) {
        store.delete(key);
      }
    }
  }, 60_000);

  // Allow garbage collection when the process exits
  if (typeof globalThis !== "undefined" && cleanupInterval?.unref) {
    cleanupInterval.unref();
  }

  return {
    async isBlacklisted(token: string): Promise<boolean> {
      const entry = store.get(`bl:${token}`);
      if (!entry) return false;
      if (entry.expiresAt <= Date.now()) {
        store.delete(`bl:${token}`);
        return false;
      }
      return true;
    },

    async blacklist(token: string, ttlSeconds = 86400 * 30): Promise<void> {
      store.set(`bl:${token}`, {
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    },

    async removeFromBlacklist(token: string): Promise<void> {
      store.delete(`bl:${token}`);
    },
  };
}

// ── Upstash Redis Adapter ───────────────────────────────────────────────────────
// Edge-compatible (uses REST API). Works on Vercel Edge, Cloudflare Workers, etc.

export interface UpstashConfig {
  /** Upstash Redis REST URL (e.g. https://xxx.upstash.io) */
  url: string;
  /** Upstash Redis REST token */
  token: string;
  /** Key prefix for blacklisted tokens. Default: "nsg:bl:" */
  prefix?: string;
}

/**
 * Creates an Upstash Redis cache adapter using the REST API.
 * Zero-dependency and Edge-compatible — no `ioredis` or `redis` needed.
 *
 * @example
 * ```ts
 * import { createUpstashAdapter } from "next-session-guard/cache";
 * const cache = createUpstashAdapter({
 *   url: process.env.UPSTASH_REDIS_REST_URL!,
 *   token: process.env.UPSTASH_REDIS_REST_TOKEN!,
 * });
 * ```
 */
export function createUpstashAdapter(config: UpstashConfig): CacheAdapter {
  const { url, token, prefix = "nsg:bl:" } = config;

  async function upstashCommand(command: string[]): Promise<any> {
    const response = await fetch(`${url}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      throw new Error(`[SessionGuard] Upstash error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.result;
  }

  return {
    async isBlacklisted(sessionToken: string): Promise<boolean> {
      const result = await upstashCommand(["EXISTS", `${prefix}${sessionToken}`]);
      return result === 1;
    },

    async blacklist(sessionToken: string, ttlSeconds = 86400 * 30): Promise<void> {
      await upstashCommand([
        "SET",
        `${prefix}${sessionToken}`,
        "1",
        "EX",
        String(ttlSeconds),
      ]);
    },

    async removeFromBlacklist(sessionToken: string): Promise<void> {
      await upstashCommand(["DEL", `${prefix}${sessionToken}`]);
    },
  };
}

// ── Generic Redis Adapter ───────────────────────────────────────────────────────
// Works with any ioredis-compatible client.

export interface GenericRedisClient {
  exists(key: string): Promise<number>;
  set(key: string, value: string, ...args: any[]): Promise<any>;
  del(key: string): Promise<number>;
}

/**
 * Creates a cache adapter from any ioredis-compatible Redis client.
 *
 * @example
 * ```ts
 * import Redis from "ioredis";
 * import { createRedisAdapter } from "next-session-guard/cache";
 * const redis = new Redis(process.env.REDIS_URL);
 * const cache = createRedisAdapter(redis);
 * ```
 */
export function createRedisAdapter(
  client: GenericRedisClient,
  prefix = "nsg:bl:"
): CacheAdapter {
  return {
    async isBlacklisted(token: string): Promise<boolean> {
      const result = await client.exists(`${prefix}${token}`);
      return result === 1;
    },

    async blacklist(token: string, ttlSeconds = 86400 * 30): Promise<void> {
      await client.set(`${prefix}${token}`, "1", "EX", ttlSeconds);
    },

    async removeFromBlacklist(token: string): Promise<void> {
      await client.del(`${prefix}${token}`);
    },
  };
}
