# Frequently Asked Questions (FAQ) ❓

Got a question about **Next-Session-Guard**? Find answers to commonly encountered scenarios below.

---

### 1. Can I use Next-Session-Guard alongside NextAuth / Auth.js, Clerk, or Supabase?
**Yes, absolutely.**
Most auth providers only issue a stateless JWT or simple session token and leave device tracking, session hijacking protection, impossible travel math, and instant remote revocation to you. 

You can use your existing authentication provider for credentials/OAuth verification, and use **Next-Session-Guard** to issue and manage the active device session signature with enterprise SOC oversight.

---

### 2. How does Geolocation and IP extraction work without paid external APIs?
Next-Session-Guard uses an intelligent header inspection waterfall that extracts geographic metadata provided for free by edge CDNs:
- **Cloudflare:** `cf-connecting-ip`, `cf-ipcountry`, `cf-iplatitude`, `cf-iplongitude`
- **Vercel:** `x-vercel-ip-country`, `x-vercel-ip-city`, `x-vercel-ip-latitude`, `x-vercel-ip-longitude`
- **AWS CloudFront:** `cloudfront-viewer-country`, `cloudfront-viewer-city`
- **Standard Fallback:** `x-forwarded-for`, `x-real-ip`

If you are running in local development without a CDN, it defaults gracefully to `127.0.0.1` and `Local Development / Unknown Location`.

---

### 3. Does Next-Session-Guard work in Docker, Kubernetes, or multi-pod clusters?
**Yes.**
For multi-instance deployments:
1. **Database:** Use standard Prisma or Drizzle connected to your PostgreSQL/MySQL cluster.
2. **Blacklist Cache:** Use the Redis or Dragonfly adapter (`createRedisCacheAdapter` or `createUpstashRedisCacheAdapter`).
3. **Real-time SSE:** In multi-pod clusters, connect your `SSEHub` to a Redis Pub/Sub backplane so revocation events broadcast across all server pods simultaneously.

---

### 4. What happens if my database or cache experiences temporary downtime?
Next-Session-Guard employs a **Fail-Safe** strategy:
- If a cache adapter fails, requests gracefully fall back to the primary database adapter.
- In `validateSession`, errors can be caught and handled with your preferred security policy (fail-closed for banking, fail-open with logging for consumer SaaS).

---

### 5. Why does my middleware redirect in an infinite loop?
Ensure that your login page and public static assets are excluded in your `middleware.ts` matcher:

```typescript
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login or public auth endpoints
     */
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)",
  ],
};
```

---

### 6. Can I customize the styling of `<ActiveSessionsCard />`?
**Yes.**
The component is styled using standard Tailwind CSS classes and accepts a `className` prop for container customization. It automatically supports both light and dark modes with sleek card borders, status badges, and device iconography.

---

### 7. How do I report a vulnerability?
Please review our [Security Policy](../SECURITY.md) and report security concerns confidentially rather than filing a public GitHub issue.
