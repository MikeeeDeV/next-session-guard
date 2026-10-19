# API Reference 📖

Complete technical reference for all public APIs, types, and exported modules in **Next-Session-Guard** (v2.0.1).

---

## 📦 Modular Subpath Directory

| Subpath | Description |
| :--- | :--- |
| `next-session-guard/server` | Server-only core engine, database adapters, and device parsing (Zero React dependencies) |
| `next-session-guard/client` | React components (`<ActiveSessionsCard />`, `<AdminSecurityPanel />`) and Client hooks |
| `next-session-guard/cache` | L1/L2 high-speed cache adapters (Memory, Upstash, Redis) for token blacklisting |
| `next-session-guard/realtime` | Server-Sent Events (SSE) hub, client streaming response, and revocation bridges |
| `next-session-guard/actions` | Next.js Server Actions for direct frontend mutations |
| `next-session-guard/telegram` | Telegram SOC bot, HMAC action vault, Mach kinetic travel, and webhook handlers |

---

## 1. `next-session-guard/server`

### `class SessionManager`

The primary server-side session management engine.

```typescript
import { SessionManager, createPrismaAdapter } from "next-session-guard/server";

const sessionManager = new SessionManager(adapter, options);
```

#### Constructor Options:
| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `tokenByteLength` | `number` | `32` | Entropy byte length for generated cryptographic tokens (64 hex chars). |
| `defaultExpirationDays` | `number` | `30` | Default session lifespan in days. |
| `autoRotateDays` | `number` | `1` | Token sliding renewal threshold (rotates token if active after X days). |
| `gcIntervalHours` | `number` | `24` | Interval for automatic garbage collection of expired sessions. |
| `cacheAdapter` | `CacheAdapter` | `undefined` | Optional cache adapter for sub-millisecond token blacklisting. |

---

### Methods

#### `createSession(options: CreateSessionOptions): Promise<Session>`
Creates a new tracked session, automatically extracting IP, User-Agent, device type, and geolocation headers.

```typescript
const session = await sessionManager.createSession({
  userId: "user_123",
  request: req, // NextRequest or Standard Request
  metadata: { email: "user@example.com", plan: "pro" },
  expiresInDays: 30
});
```

#### `validateSession(token: string, options?: ValidateSessionOptions): Promise<ValidationResult>`
Validates a session token against expiration and checks for session hijacking anomalies.

```typescript
const result = await sessionManager.validateSession(token, {
  request: req,
  hijackingPolicy: "strict", // "strict" | "relaxed" | "none"
  updateLastActive: true
});

if (!result.isValid) {
  console.log("Session invalid reason:", result.reason);
}
```

#### `revokeSession(sessionId: string): Promise<boolean>`
Terminates a specific session immediately and adds its token to the cache blacklist.

```typescript
await sessionManager.revokeSession("sess_abc123");
```

#### `revokeAllOtherSessions(userId: string, currentSessionId: string): Promise<number>`
Revokes all active sessions for a user *except* the currently active one (useful for "Log out all other devices").

```typescript
const revokedCount = await sessionManager.revokeAllOtherSessions("user_123", currentSessionId);
```

#### `getUserActiveSessions(userId: string): Promise<Session[]>`
Retrieves all non-expired, active sessions for a specific user, ordered by `lastActiveAt DESC`.

```typescript
const sessions = await sessionManager.getUserActiveSessions("user_123");
```

#### `cleanupExpiredSessions(options?: GCOptions): Promise<number>`
Prunes expired sessions from the database based on retention rules.

```typescript
const deletedCount = await sessionManager.cleanupExpiredSessions({
  retentionDays: 30 // Purges sessions expired more than 30 days ago
});
```

---

### Storage Adapters

#### `createPrismaAdapter(prisma: PrismaClient): SessionStorageAdapter`
Creates a database adapter for Prisma ORM.

```typescript
import { createPrismaAdapter } from "next-session-guard/server";
import { prisma } from "@/lib/prisma";

const adapter = createPrismaAdapter(prisma);
```

#### `createDrizzleAdapter(db: any, table: any): SessionStorageAdapter`
Creates a database adapter for Drizzle ORM.

```typescript
import { createDrizzleAdapter } from "next-session-guard/server";
import { db } from "@/lib/db";
import { sessions } from "@/lib/schema";

const adapter = createDrizzleAdapter(db, sessions);
```

#### `createMemoryAdapter(): SessionStorageAdapter`
High-speed in-memory store for integration tests, playgrounds, and development.

```typescript
import { createMemoryAdapter } from "next-session-guard/server";

const memoryAdapter = createMemoryAdapter();
```

---

## 2. `next-session-guard/client`

### `<ActiveSessionsCard />`

Interactive UI component for users to view their active devices and remotely revoke them.

```tsx
import { ActiveSessionsCard } from "next-session-guard/client";

<ActiveSessionsCard
  apiUrl="/api/sessions"
  enableRealtime={true}
  sseUrl="/api/sessions/sse"
  currentSessionId="sess_curr123"
  onRevoke={(sessionId) => console.log("Revoked:", sessionId)}
  className="shadow-lg rounded-xl"
/>
```

#### Props:
| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `apiUrl` | `string` | `"/api/sessions"` | Route handler for fetching and revoking sessions. |
| `enableRealtime` | `boolean` | `true` | Enables live updates via Server-Sent Events. |
| `sseUrl` | `string` | `"/api/sessions/sse"` | Route handler serving the SSE stream. |
| `currentSessionId` | `string` | `undefined` | Marks the current device with a badge. |
| `onRevoke` | `(id: string) => void` | `undefined` | Callback fired when a session is revoked. |

---

### `<AdminSecurityPanel />`

Comprehensive Security Operations Center GUI for platform administrators.

```tsx
import { AdminSecurityPanel } from "next-session-guard/client";

<AdminSecurityPanel
  adminApiUrl="/api/admin/sessions"
  cleanupApiUrl="/api/admin/cleanup"
  allowAttackSimulation={true}
/>
```

---

### `useSessionGuard(options)`

React Hook to listen for remote kick events on the client side.

```tsx
import { useSessionGuard } from "next-session-guard/client";

export function AppShell({ children }: { children: React.ReactNode }) {
  useSessionGuard({
    sseUrl: "/api/sessions/sse",
    onRevoked: () => {
      alert("Your session was terminated remotely.");
      window.location.href = "/login?revoked=true";
    }
  });

  return <>{children}</>;
}
```

---

## 3. `next-session-guard/cache`

```typescript
import {
  createMemoryCacheAdapter,
  createUpstashRedisCacheAdapter,
  createRedisCacheAdapter
} from "next-session-guard/cache";
```

### Methods:
- `isBlacklisted(token: string): Promise<boolean>`
- `blacklistToken(token: string, ttlSeconds: number): Promise<void>`
- `removeBlacklist(token: string): Promise<void>`
- `getStats(): Promise<CacheStats>`

---

## 4. `next-session-guard/realtime`

### `SSEHub`

Manages active Server-Sent Event connections and multi-tab broadcast messaging.

```typescript
import { SSEHub, createSSERevocationBridge } from "next-session-guard/realtime";

export const sseHub = new SSEHub({
  heartbeatIntervalMs: 15000,
  maxConnectionsPerUser: 10
});

// Create Next.js Route Handler Stream
export async function GET(req: Request) {
  const userId = getAuthenticatedUserId(req);
  return sseHub.createStreamResponse(userId);
}
```

---

## 5. `next-session-guard/telegram`

### `createTelegramSOC(options)`

Configures the Telegram autonomous security bot.

```typescript
import { createTelegramSOC } from "next-session-guard/telegram";

export const telegramSOC = createTelegramSOC({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID!,
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET!,
  vaultSecret: process.env.HMAC_VAULT_SECRET!,
  autoLockdown: true
});
```
