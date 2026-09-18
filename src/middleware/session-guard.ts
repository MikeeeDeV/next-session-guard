import { NextRequest, NextResponse } from "next/server";

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
}

/**
 * Middleware session guard to verify that active cookies haven't been revoked remotely
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
    const isValid = await options.validateToken(tokenCookie);
    if (!isValid) {
      // Clear cookie and redirect
      const redirectTarget = new URL(
        options.redirectUrl || "/auth/login?revoked=true",
        req.nextUrl
      );
      const response = NextResponse.redirect(redirectTarget);
      response.cookies.delete(options.cookieName || defaultCookie);
      return response;
    }
  }

  return null;
}

