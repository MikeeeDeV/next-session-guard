import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createMemoryAdapter,
  createUpstashAdapter,
  createRedisAdapter,
  type GenericRedisClient,
} from "../src/cache/index";

describe("createMemoryAdapter", () => {
  let cache: ReturnType<typeof createMemoryAdapter>;

  beforeEach(() => {
    cache = createMemoryAdapter();
  });

  it("returns false for a non-blacklisted token", async () => {
    const result = await cache.isBlacklisted("token-123");
    expect(result).toBe(false);
  });

  it("blacklists a token", async () => {
    await cache.blacklist("token-456");
    const result = await cache.isBlacklisted("token-456");
    expect(result).toBe(true);
  });

  it("removes a token from blacklist", async () => {
    await cache.blacklist("token-789");
    expect(await cache.isBlacklisted("token-789")).toBe(true);

    await cache.removeFromBlacklist("token-789");
    expect(await cache.isBlacklisted("token-789")).toBe(false);
  });

  it("handles multiple tokens independently", async () => {
    await cache.blacklist("token-a");
    await cache.blacklist("token-b");

    expect(await cache.isBlacklisted("token-a")).toBe(true);
    expect(await cache.isBlacklisted("token-b")).toBe(true);
    expect(await cache.isBlacklisted("token-c")).toBe(false);

    await cache.removeFromBlacklist("token-a");
    expect(await cache.isBlacklisted("token-a")).toBe(false);
    expect(await cache.isBlacklisted("token-b")).toBe(true);
  });

  it("expires tokens after TTL", async () => {
    // Blacklist with 1 second TTL
    await cache.blacklist("token-expiring", 1);
    expect(await cache.isBlacklisted("token-expiring")).toBe(true);

    // Fast-forward time by 2 seconds
    vi.useFakeTimers();
    vi.advanceTimersByTime(2000);

    expect(await cache.isBlacklisted("token-expiring")).toBe(false);
    vi.useRealTimers();
  });

  it("removes from non-existent token without error", async () => {
    await expect(cache.removeFromBlacklist("non-existent")).resolves.toBeUndefined();
  });

  it("re-blacklisting extends the token", async () => {
    await cache.blacklist("token-renew", 1);
    expect(await cache.isBlacklisted("token-renew")).toBe(true);

    // Re-blacklist with longer TTL
    await cache.blacklist("token-renew", 3600);
    expect(await cache.isBlacklisted("token-renew")).toBe(true);
  });
});

describe("createUpstashAdapter", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("checks blacklist correctly using default prefix", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 1 }),
    });
    globalThis.fetch = mockFetch;

    const adapter = createUpstashAdapter({
      url: "https://example-upstash.io",
      token: "secret-token",
    });

    const isBl = await adapter.isBlacklisted("token-xyz");
    expect(isBl).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example-upstash.io",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["EXISTS", "nsg:bl:token-xyz"]),
      })
    );
  });

  it("returns false if Upstash returns 0 for EXISTS", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 0 }),
    });

    const adapter = createUpstashAdapter({
      url: "https://example-upstash.io",
      token: "secret-token",
      prefix: "custom:",
    });

    const isBl = await adapter.isBlacklisted("token-123");
    expect(isBl).toBe(false);
  });

  it("blacklists a token with custom TTL and prefix", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: "OK" }),
    });
    globalThis.fetch = mockFetch;

    const adapter = createUpstashAdapter({
      url: "https://example-upstash.io",
      token: "secret-token",
      prefix: "test:",
    });

    await adapter.blacklist("token-abc", 600);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example-upstash.io",
      expect.objectContaining({
        body: JSON.stringify(["SET", "test:token-abc", "1", "EX", "600"]),
      })
    );
  });

  it("removes token from blacklist", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 1 }),
    });
    globalThis.fetch = mockFetch;

    const adapter = createUpstashAdapter({
      url: "https://example-upstash.io",
      token: "secret-token",
    });

    await adapter.removeFromBlacklist("token-del");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example-upstash.io",
      expect.objectContaining({
        body: JSON.stringify(["DEL", "nsg:bl:token-del"]),
      })
    );
  });

  it("throws error when Upstash HTTP call fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    const adapter = createUpstashAdapter({
      url: "https://example-upstash.io",
      token: "bad-token",
    });

    await expect(adapter.isBlacklisted("token")).rejects.toThrow(
      "[SessionGuard] Upstash error: 401 Unauthorized"
    );
  });
});

describe("createRedisAdapter", () => {
  it("checks blacklist correctly using GenericRedisClient", async () => {
    const client: GenericRedisClient = {
      exists: vi.fn().mockResolvedValue(1),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
    };

    const adapter = createRedisAdapter(client);

    const isBl = await adapter.isBlacklisted("token-redis");
    expect(isBl).toBe(true);
    expect(client.exists).toHaveBeenCalledWith("nsg:bl:token-redis");

    (client.exists as any).mockResolvedValueOnce(0);
    expect(await adapter.isBlacklisted("token-not-found")).toBe(false);
  });

  it("blacklists and removes tokens using custom prefix and TTL", async () => {
    const client: GenericRedisClient = {
      exists: vi.fn().mockResolvedValue(0),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
    };

    const adapter = createRedisAdapter(client, "myprefix:");

    await adapter.blacklist("token-redis", 120);
    expect(client.set).toHaveBeenCalledWith("myprefix:token-redis", "1", "EX", 120);

    await adapter.removeFromBlacklist("token-redis");
    expect(client.del).toHaveBeenCalledWith("myprefix:token-redis");
  });
});
