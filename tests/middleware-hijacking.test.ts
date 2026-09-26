import { describe, it, expect, vi, beforeEach } from "vitest";
import { sessionGuardMiddleware } from "../src/middleware/session-guard";
import type { SessionGuardOptions } from "../src/middleware/session-guard";

// Mock NextRequest and NextResponse
function createMockRequest(
  pathname: string,
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {}
): any {
  const cookieMap = new Map(Object.entries(cookies));
  const headerMap = new Map(Object.entries(headers));

  return {
    nextUrl: {
      pathname,
      toString: () => `http://localhost${pathname}`,
    },
    cookies: {
      get: (name: string) => {
        const val = cookieMap.get(name);
        return val ? { value: val } : undefined;
      },
    },
    headers: {
      get: (name: string) => headerMap.get(name) || null,
    },
    url: `http://localhost${pathname}`,
  };
}

// Mock NextResponse
vi.mock("next/server", () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    redirect: vi.fn((url: URL) => ({
      type: "redirect",
      url: url.toString(),
      cookies: {
        delete: vi.fn(),
      },
      headers: {
        set: vi.fn(),
      },
    })),
  },
}));

describe("Middleware Hijacking Protection", () => {
  it("should detect IP hijack in strict mode", async () => {
    const onHijackDetected = vi.fn();
    const revokeOnHijack = vi.fn();

    const options: SessionGuardOptions = {
      validateToken: async () => true,
      hijackingProtection: "strict",
      getSessionFingerprint: async () => ({
        ip: "1.2.3.4",
        country: "US",
      }),
      onHijackDetected,
      revokeOnHijack,
    };

    const req = createMockRequest("/dashboard", {
      "next-auth.session-token": "test-token",
    }, {
      "x-forwarded-for": "5.6.7.8", // Different IP
    });

    const result = await sessionGuardMiddleware(req, options);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("redirect");
    expect(onHijackDetected).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "test-token",
        storedIp: "1.2.3.4",
        requestIp: "5.6.7.8",
      })
    );
    expect(revokeOnHijack).toHaveBeenCalledWith("test-token");
  });

  it("should allow same IP in strict mode", async () => {
    const options: SessionGuardOptions = {
      validateToken: async () => true,
      hijackingProtection: "strict",
      getSessionFingerprint: async () => ({
        ip: "1.2.3.4",
        country: "US",
      }),
    };

    const req = createMockRequest("/dashboard", {
      "next-auth.session-token": "test-token",
    }, {
      "x-forwarded-for": "1.2.3.4", // Same IP
    });

    const result = await sessionGuardMiddleware(req, options);
    expect(result).toBeNull(); // No redirect, session valid
  });

  it("should detect country hijack in relaxed mode", async () => {
    const options: SessionGuardOptions = {
      validateToken: async () => true,
      hijackingProtection: "relaxed",
      getSessionFingerprint: async () => ({
        ip: "1.2.3.4",
        country: "US",
      }),
    };

    const req = createMockRequest("/dashboard", {
      "next-auth.session-token": "test-token",
    }, {
      "x-forwarded-for": "5.6.7.8", // Different IP
      "x-vercel-ip-country": "RU", // Different country
    });

    const result = await sessionGuardMiddleware(req, options);
    expect(result).not.toBeNull();
  });

  it("should allow different IP but same country in relaxed mode", async () => {
    const options: SessionGuardOptions = {
      validateToken: async () => true,
      hijackingProtection: "relaxed",
      getSessionFingerprint: async () => ({
        ip: "1.2.3.4",
        country: "US",
      }),
    };

    const req = createMockRequest("/dashboard", {
      "next-auth.session-token": "test-token",
    }, {
      "x-forwarded-for": "5.6.7.8", // Different IP
      "x-vercel-ip-country": "US", // Same country
    });

    const result = await sessionGuardMiddleware(req, options);
    expect(result).toBeNull();
  });

  it("should skip hijacking check on public paths", async () => {
    const getSessionFingerprint = vi.fn();

    const options: SessionGuardOptions = {
      validateToken: async () => true,
      hijackingProtection: "strict",
      getSessionFingerprint,
    };

    const req = createMockRequest("/auth/login", {
      "next-auth.session-token": "test-token",
    });

    const result = await sessionGuardMiddleware(req, options);
    expect(result).toBeNull();
    expect(getSessionFingerprint).not.toHaveBeenCalled();
  });

  it("should skip hijacking check when no fingerprint function provided", async () => {
    const options: SessionGuardOptions = {
      validateToken: async () => true,
      hijackingProtection: "strict",
      // No getSessionFingerprint
    };

    const req = createMockRequest("/dashboard", {
      "next-auth.session-token": "test-token",
    }, {
      "x-forwarded-for": "5.6.7.8",
    });

    const result = await sessionGuardMiddleware(req, options);
    expect(result).toBeNull();
  });

  it("should blacklist hijacked token in cache", async () => {
    const cache = {
      isBlacklisted: vi.fn(async () => false),
      blacklist: vi.fn(async () => {}),
      removeFromBlacklist: vi.fn(async () => {}),
    };

    const options: SessionGuardOptions = {
      validateToken: async () => true,
      hijackingProtection: "strict",
      cache,
      getSessionFingerprint: async () => ({
        ip: "1.2.3.4",
        country: "US",
      }),
    };

    const req = createMockRequest("/dashboard", {
      "next-auth.session-token": "hijacked-token",
    }, {
      "x-forwarded-for": "9.9.9.9",
    });

    await sessionGuardMiddleware(req, options);
    expect(cache.blacklist).toHaveBeenCalledWith("hijacked-token");
  });

  it("should handle Cloudflare IP headers", async () => {
    const options: SessionGuardOptions = {
      validateToken: async () => true,
      hijackingProtection: "strict",
      getSessionFingerprint: async () => ({
        ip: "1.2.3.4",
        country: "US",
      }),
    };

    const req = createMockRequest("/dashboard", {
      "next-auth.session-token": "cf-token",
    }, {
      "cf-connecting-ip": "5.6.7.8",
    });

    const result = await sessionGuardMiddleware(req, options);
    expect(result).not.toBeNull();
  });

  it("should handle Cloudflare country headers", async () => {
    const options: SessionGuardOptions = {
      validateToken: async () => true,
      hijackingProtection: "relaxed",
      getSessionFingerprint: async () => ({
        ip: "1.2.3.4",
        country: "US",
      }),
    };

    const req = createMockRequest("/dashboard", {
      "next-auth.session-token": "cf-token",
    }, {
      "cf-ipcountry": "RU",
    });

    const result = await sessionGuardMiddleware(req, options);
    expect(result).not.toBeNull();
  });
});
