import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMemoryAdapter } from "../src/cache/index";

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
