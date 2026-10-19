# Migration Guide (v1.x ➔ v2.0.1) 🔄

This guide covers upgrading existing installations of **Next-Session-Guard** to **v2.0.1**.

---

## 🌟 What's New in v2.0.1

- 🧩 **100% Modular Subpaths:** Separated into `next-session-guard/server`, `next-session-guard/client`, `next-session-guard/cache`, `next-session-guard/realtime`, and `next-session-guard/telegram`.
- ⚡ **Next.js 15 & 16 Ready:** Complete compliance with Next.js 15 App Router runtime boundaries and async `cookies()`.
- 🗄️ **Zero-Database Testing Store:** `createMemoryAdapter()` now includes a Prisma-compatible `.session` mock for plug-and-play development and playgrounds.
- 📡 **Universal SSE Revocation Bridge:** `createSSERevocationBridge` now accepts an `SSEHub` instance directly and provides `.createStreamResponse()` helper.

---

## ⚠️ Breaking Changes & Codemods

### 1. Update Import Paths

In v1.x, all symbols were imported from the root package. In v2.0.1, server-only code and client components have dedicated subpaths:

#### Before (v1.x):
```typescript
import { 
  SessionManager, 
  createPrismaAdapter, 
  ActiveSessionsCard 
} from "next-session-guard";
```

#### After (v2.0.1):
```typescript
// In Route Handlers, Server Actions, or RSC:
import { SessionManager, createPrismaAdapter } from "next-session-guard/server";

// In Client Components:
import { ActiveSessionsCard } from "next-session-guard/client";

// In Realtime SSE Routes:
import { SSEHub, createSSERevocationBridge } from "next-session-guard/realtime";

// In Cache Utilities:
import { createUpstashRedisCacheAdapter } from "next-session-guard/cache";
```

---

### 2. Next.js 15 Async `cookies()`

In Next.js 15, `cookies()` returns a Promise and must be awaited:

#### Before (Next.js 14):
```typescript
import { cookies } from "next/headers";

const token = cookies().get("session_token")?.value;
```

#### After (Next.js 15):
```typescript
import { cookies } from "next/headers";

const cookieStore = await cookies();
const token = cookieStore.get("session_token")?.value;
```

---

### 3. SSERevocationBridge Initialization

In v2.0.1, `createSSERevocationBridge` can take the `SSEHub` instance directly:

```typescript
import { SSEHub, createSSERevocationBridge } from "next-session-guard/realtime";

export const sseHub = new SSEHub();
export const bridge = createSSERevocationBridge(sseHub);
```

---

## 📋 Migration Checklist

- [ ] Run `npm install next-session-guard@latest`.
- [ ] Replace server imports with `next-session-guard/server`.
- [ ] Replace UI component imports with `next-session-guard/client`.
- [ ] If using caching, import adapters from `next-session-guard/cache`.
- [ ] Run `npm run typecheck` or `npx tsc --noEmit` to verify type safety.
- [ ] Test login, multi-device view, and remote revocation in local dev.
