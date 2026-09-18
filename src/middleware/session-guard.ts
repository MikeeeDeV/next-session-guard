import { NextRequest, NextResponse } from "next/server";
import type { CacheAdapter } from "../core/types";

export interface SessionGuardOptions {
  /**
   * Cookie name used for the session token.
   * Default: "next-auth.session-token" (or "__Secure-next-auth.session-token" in production)
   */
  cookieName?: string;

  /**
   * Function to validate the token against the database or cache
   */
  validateToken: (token: string) => Promise<boolean>;

  /**
   * Where to redirect if the session has been revoked or expired
   * Default: "/auth/login?revoked=true"
   */
  redirectUrl?: string;

  /**
   * Paths to exclude from session enforcement
   */
  publicPaths?: string[];

  /**
   * Optional cache adapter for sub-millisecond Edge blacklist checks.
   * When provided, the middleware checks the cache FIRST before calling validateToken.
   * This avoids hitting the database on every single request.
   */
  cache?: CacheAdapter;
}

/**
 * Middleware session guard to verify that active cookies haven't been revoked remotely.
 * When a cache adapter is provided, revoked tokens are checked in sub-millisecond time
 * before falling back to the database.
 */
export async function sessionGuardMiddleware(
  req: NextRequest,
  options: SessionGuardOptions
): Promise<NextResponse | null> {
  const { pathname } = req.nextUrl;
  const publicPaths = options.publicPaths || ["/auth/login", "/auth/register", "/api/auth"];

  // Skip public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return null;
  }

  const defaultCookie =
    process.env.NODE_ENV === "production"
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

  const tokenCookie = req.cookies.get(options.cookieName || defaultCookie)?.value;

  if (tokenCookie) {
    // ── Fast path: Check cache blacklist first ─────────────
    if (options.cache) {
      try {
        const isBlacklisted = await options.cache.isBlacklisted(tokenCookie);
        if (isBlacklisted) {
          return createRevokedResponse(req, options, defaultCookie);
        }
      } catch (err) {
        console.error("[SessionGuard Middleware] Cache check error:", err);
        // Fall through to validateToken
      }
    }

    // ── Standard path: Validate against database ──────────
    const isValid = await options.validateToken(tokenCookie);
    if (!isValid) {
      // Auto-blacklist in cache for future fast rejection
      if (options.cache) {
        options.cache
          .blacklist(tokenCookie)
          .catch((err) => console.error("[SessionGuard Middleware] Cache blacklist error:", err));
      }
      return createRevokedResponse(req, options, defaultCookie);
    }
  }

  return null;
}

/**
 * Creates a redirect response for revoked/expired sessions
 */
function createRevokedResponse(
  req: NextRequest,
  options: SessionGuardOptions,
  defaultCookie: string
): NextResponse {
  const redirectTarget = new URL(
    options.redirectUrl || "/auth/login?revoked=true",
    req.nextUrl
  );
  const response = NextResponse.redirect(redirectTarget);
  response.cookies.delete(options.cookieName || defaultCookie);
  return response;
}
