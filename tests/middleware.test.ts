import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { sessionGuardMiddleware, type SessionGuardOptions } from "../src/middleware/session-guard";
import type { CacheAdapter } from "../src/core/types";

describe("sessionGuardMiddleware", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  function createMockRequest(url: string, cookies: Record<string, string> = {}) {
    const req = new NextRequest(new URL(url, "http://localhost:3000"));
    for (const [key, value] of Object.entries(cookies)) {
      req.cookies.set(key, value);
    }
    return req;
  }

  it("bypasses default public paths", async () => {
    const validateToken = vi.fn();
    const options: SessionGuardOptions = { validateToken };

    const reqLogin = createMockRequest("/auth/login");
    const resLogin = await sessionGuardMiddleware(reqLogin, options);
    expect(resLogin).toBeNull();

    const reqRegister = createMockRequest("/auth/register");
    const resRegister = await sessionGuardMiddleware(reqRegister, options);
    expect(resRegister).toBeNull();

    const reqAuthApi = createMockRequest("/api/auth/session");
    const resAuthApi = await sessionGuardMiddleware(reqAuthApi, options);
    expect(resAuthApi).toBeNull();

    expect(validateToken).not.toHaveBeenCalled();
  });

  it("bypasses custom configured public paths", async () => {
    const validateToken = vi.fn();
    const options: SessionGuardOptions = {
      validateToken,
      publicPaths: ["/landing", "/terms"],
    };

    const reqLanding = createMockRequest("/landing/intro");
    const resLanding = await sessionGuardMiddleware(reqLanding, options);
    expect(resLanding).toBeNull();

    expect(validateToken).not.toHaveBeenCalled();
  });

  it("returns null when no session cookie is present", async () => {
    const validateToken = vi.fn();
    const options: SessionGuardOptions = { validateToken };

    const req = createMockRequest("/dashboard");
    const res = await sessionGuardMiddleware(req, options);

    expect(res).toBeNull();
    expect(validateToken).not.toHaveBeenCalled();
  });

  it("returns null when token is valid in development mode", async () => {
    process.env.NODE_ENV = "development";
    const validateToken = vi.fn().mockResolvedValue(true);
    const options: SessionGuardOptions = { validateToken };

    const req = createMockRequest("/dashboard", {
      "next-auth.session-token": "valid-dev-token",
    });

    const res = await sessionGuardMiddleware(req, options);
    expect(res).toBeNull();
    expect(validateToken).toHaveBeenCalledWith("valid-dev-token");
  });

  it("uses __Secure- prefix cookie in production mode by default", async () => {
    process.env.NODE_ENV = "production";
    const validateToken = vi.fn().mockResolvedValue(true);
    const options: SessionGuardOptions = { validateToken };

    const req = createMockRequest("/dashboard", {
      "__Secure-next-auth.session-token": "secure-prod-token",
    });

    const res = await sessionGuardMiddleware(req, options);
    expect(res).toBeNull();
    expect(validateToken).toHaveBeenCalledWith("secure-prod-token");
  });

  it("uses custom cookieName if provided", async () => {
    const validateToken = vi.fn().mockResolvedValue(true);
    const options: SessionGuardOptions = {
      cookieName: "my-custom-cookie",
      validateToken,
    };

    const req = createMockRequest("/dashboard", {
      "my-custom-cookie": "custom-token-val",
    });

    const res = await sessionGuardMiddleware(req, options);
    expect(res).toBeNull();
    expect(validateToken).toHaveBeenCalledWith("custom-token-val");
  });

  it("redirects and deletes cookie immediately when blacklisted in cache (fast path)", async () => {
    const mockCache: CacheAdapter = {
      isBlacklisted: vi.fn().mockResolvedValue(true),
      blacklist: vi.fn(),
      removeFromBlacklist: vi.fn(),
    };
    const validateToken = vi.fn().mockResolvedValue(true);

    const options: SessionGuardOptions = {
      validateToken,
      cache: mockCache,
    };

    const req = createMockRequest("/dashboard", {
      "next-auth.session-token": "blacklisted-token",
    });

    const res = await sessionGuardMiddleware(req, options);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(307); // NextResponse.redirect default status
    expect(res?.headers.get("location")).toContain("/auth/login?revoked=true");
    expect(validateToken).not.toHaveBeenCalled(); // Fast path skipped DB check!
  });

  it("falls through to validateToken when cache throws an error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockCache: CacheAdapter = {
      isBlacklisted: vi.fn().mockRejectedValue(new Error("Redis connection timed out")),
      blacklist: vi.fn(),
      removeFromBlacklist: vi.fn(),
    };
    const validateToken = vi.fn().mockResolvedValue(true);

    const options: SessionGuardOptions = {
      validateToken,
      cache: mockCache,
    };

    const req = createMockRequest("/dashboard", {
      "next-auth.session-token": "token-test",
    });

    const res = await sessionGuardMiddleware(req, options);
    expect(res).toBeNull();
    expect(validateToken).toHaveBeenCalledWith("token-test");
    expect(consoleSpy).toHaveBeenCalledWith(
      "[SessionGuard Middleware] Cache check error:",
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it("redirects and auto-blacklists token in cache when validateToken returns false", async () => {
    const mockCache: CacheAdapter = {
      isBlacklisted: vi.fn().mockResolvedValue(false),
      blacklist: vi.fn().mockResolvedValue(undefined),
      removeFromBlacklist: vi.fn(),
    };
    const validateToken = vi.fn().mockResolvedValue(false);

    const options: SessionGuardOptions = {
      validateToken,
      cache: mockCache,
    };

    const req = createMockRequest("/dashboard", {
      "next-auth.session-token": "invalid-token",
    });

    const res = await sessionGuardMiddleware(req, options);
    expect(res).not.toBeNull();
    expect(res?.headers.get("location")).toContain("/auth/login?revoked=true");
    expect(mockCache.blacklist).toHaveBeenCalledWith("invalid-token");
  });

  it("handles cache blacklist error gracefully when validateToken returns false", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockCache: CacheAdapter = {
      isBlacklisted: vi.fn().mockResolvedValue(false),
      blacklist: vi.fn().mockRejectedValue(new Error("Cache write failed")),
      removeFromBlacklist: vi.fn(),
    };
    const validateToken = vi.fn().mockResolvedValue(false);

    const options: SessionGuardOptions = {
      validateToken,
      cache: mockCache,
    };

    const req = createMockRequest("/dashboard", {
      "next-auth.session-token": "invalid-token",
    });

    const res = await sessionGuardMiddleware(req, options);
    expect(res).not.toBeNull();

    await new Promise((r) => setTimeout(r, 50));
    expect(consoleSpy).toHaveBeenCalledWith(
      "[SessionGuard Middleware] Cache blacklist error:",
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it("uses custom redirectUrl when provided", async () => {
    const validateToken = vi.fn().mockResolvedValue(false);
    const options: SessionGuardOptions = {
      validateToken,
      redirectUrl: "/custom-login?reason=session-expired",
    };

    const req = createMockRequest("/dashboard", {
      "next-auth.session-token": "expired-token",
    });

    const res = await sessionGuardMiddleware(req, options);
    expect(res).not.toBeNull();
    expect(res?.headers.get("location")).toContain("/custom-login?reason=session-expired");
  });
});
