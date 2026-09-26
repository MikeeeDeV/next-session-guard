import { NextRequest, NextResponse } from "next/server";
import type { CacheAdapter, SessionRevokedEvent } from "../core/types";

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

  /**
   * Session hijacking protection mode.
   * - "strict": IP must match exactly (banks, finance)
   * - "relaxed": Only country must match (mobile-friendly)
   * - false/undefined: Disabled
   */
  hijackingProtection?: "strict" | "relaxed" | false;

  /**
   * Function to look up the session's stored IP or country for hijacking comparison.
   * Required when hijackingProtection is enabled.
   *
   * @example
   * getSessionFingerprint: async (token) => {
   *   const session = await prisma.session.findUnique({ where: { sessionToken: token } });
   *   return session ? { ip: session.ipAddress, country: session.country } : null;
   * }
   */
  getSessionFingerprint?: (
    token: string
  ) => Promise<{ ip?: string | null; country?: string | null } | null>;

  /**
   * Callback fired when a hijack attempt is detected.
   * Use for logging, alerting, or Telegram notifications.
   */
  onHijackDetected?: (event: {
    token: string;
    storedIp?: string | null;
    requestIp: string;
    storedCountry?: string | null;
    requestCountry?: string;
  }) => Promise<void> | void;

  /**
   * Function to auto-revoke the session when a hijack is detected.
   */
  revokeOnHijack?: (token: string) => Promise<void>;
}

/**
 * Extract the client IP from request headers (works on Vercel, CF, and standard proxies)
 */
function getRequestIP(req: NextRequest): string | undefined {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    (req as any).ip ||
    undefined
  );
}

/**
 * Extract the request country from hosting provider headers
 */
function getRequestCountry(req: NextRequest): string | undefined {
  return (
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    (req as any).geo?.country ||
    undefined
  );
}

/**
 * Middleware session guard to verify that active cookies haven't been revoked remotely.
 * Now with optional session hijacking protection via IP/country binding.
 *
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

    // ── Hijacking Protection ──────────────────────────────
    if (options.hijackingProtection && options.getSessionFingerprint) {
      const fingerprint = await options.getSessionFingerprint(tokenCookie);

      if (fingerprint) {
        const requestIp = getRequestIP(req);
        const requestCountry = getRequestCountry(req);

        let isHijacked = false;

        if (options.hijackingProtection === "strict") {
          // Strict: IP must match exactly
          if (requestIp && fingerprint.ip && requestIp !== fingerprint.ip) {
            isHijacked = true;
          }
        } else if (options.hijackingProtection === "relaxed") {
          // Relaxed: Country must match
          if (
            requestCountry &&
            fingerprint.country &&
            requestCountry.toUpperCase() !== fingerprint.country.toUpperCase()
          ) {
            isHijacked = true;
          }
        }

        if (isHijacked) {
          // Fire hijack callback
          if (options.onHijackDetected) {
            const hijackEvent = {
              token: tokenCookie,
              storedIp: fingerprint.ip,
              requestIp: requestIp || "unknown",
              storedCountry: fingerprint.country,
              requestCountry,
            };
            try {
              await options.onHijackDetected(hijackEvent);
            } catch (err) {
              console.error("[SessionGuard Middleware] onHijackDetected error:", err);
            }
          }

          // Auto-revoke the hijacked session
          if (options.revokeOnHijack) {
            try {
              await options.revokeOnHijack(tokenCookie);
            } catch (err) {
              console.error("[SessionGuard Middleware] revokeOnHijack error:", err);
            }
          }

          // Also blacklist in cache
          if (options.cache) {
            options.cache
              .blacklist(tokenCookie)
              .catch((err) =>
                console.error("[SessionGuard Middleware] Cache blacklist error:", err)
              );
          }

          return createHijackResponse(req, options, defaultCookie);
        }
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

/**
 * Creates a redirect response for hijack-detected sessions
 */
function createHijackResponse(
  req: NextRequest,
  options: SessionGuardOptions,
  defaultCookie: string
): NextResponse {
  const redirectTarget = new URL(
    options.redirectUrl || "/auth/login?hijack=true",
    req.nextUrl
  );
  const response = NextResponse.redirect(redirectTarget);
  response.cookies.delete(options.cookieName || defaultCookie);
  // Add security header
  response.headers.set("X-Session-Guard", "hijack-detected");
  return response;
}
