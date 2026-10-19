# Getting Started 🚀

This guide walks you through setting up **Next-Session-Guard** in your Next.js project from scratch in under 5 minutes.

---

## 📋 Prerequisites

- **Next.js:** 14+, 15+, or 16+ (App Router recommended)
- **Node.js:** 18.17+ or 20+
- **ORM / Storage:** Prisma, Drizzle ORM, or In-Memory (for testing/development)

---

## 1. Installation

Install the package via your package manager of choice:

```bash
npm install next-session-guard
# or
pnpm add next-session-guard
# or
yarn add next-session-guard
```

### Peer Dependencies
If you are using UI components (`<ActiveSessionsCard />`, `<AdminSecurityPanel />`), install the peer dependencies:

```bash
npm install @prisma/client lucide-react
```

---

## 2. Database Schema Setup

Choose the adapter that matches your tech stack:

### Option A: Prisma ORM

Add the `Session` model to your `prisma/schema.prisma`:

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  sessions  Session[]
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  token        String   @unique
  ipAddress    String?
  userAgent    String?
  deviceType   String?
  os           String?
  browser      String?
  city         String?
  country      String?
  countryCode  String?
  latitude     Float?
  longitude    Float?
  lastActiveAt DateTime @default(now())
  createdAt    DateTime @default(now())
  expiresAt    DateTime
  metadata     String?  // JSON stringified optional metadata

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
}
```

Run migration:
```bash
npx prisma migrate dev --name init_sessions
```

### Option B: Drizzle ORM

Define the session table in your schema file (e.g. `schema.ts`):

```typescript
import { pgTable, text, timestamp, doublePrecision } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceType: text("device_type"),
  os: text("os"),
  browser: text("browser"),
  city: text("city"),
  country: text("country"),
  countryCode: text("country_code"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  metadata: text("metadata")
});
```

### Option C: In-Memory Adapter (Testing & Prototypes)

No database needed! Perfect for mock apps, integration tests, or playgrounds:

```typescript
import { createMemoryAdapter } from "next-session-guard/server";

const memoryAdapter = createMemoryAdapter();
```

---

## 3. Initializing SessionManager

Create a centralized session utility file, e.g. `lib/session.ts`:

```typescript
// lib/session.ts
import { SessionManager, createPrismaAdapter } from "next-session-guard/server";
import { prisma } from "@/lib/prisma";

export const sessionManager = new SessionManager(createPrismaAdapter(prisma), {
  tokenByteLength: 32, // Secure cryptographic token entropy
  defaultExpirationDays: 30,
  autoRotateDays: 1,   // Slidably rotates session token every 24h of active use
  gcIntervalHours: 24  // Automatic garbage collection of expired sessions
});
```

---

## 4. Creating a Session on Login

Create your login API route at `app/api/auth/login/route.ts`:

```typescript
// app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { sessionManager } from "@/lib/session";

export async function POST(req: Request) {
  const { userId, email } = await req.json();

  // 1. Create the tracked session
  const session = await sessionManager.createSession({
    userId,
    request: req, // Automatically extracts IP, device type, OS, browser, and Geo
    metadata: { email },
    expiresInDays: 30
  });

  const response = NextResponse.json({ success: true, session });

  // 2. Set secure HttpOnly cookie
  response.cookies.set("session_token", session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt
  });

  return response;
}
```

---

## 5. Validating Sessions in Middleware / Protected Pages

In `middleware.ts`:

```typescript
// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { sessionManager } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("session_token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Validate session and check hijacking risk
  const validation = await sessionManager.validateSession(token, {
    request: req,
    hijackingPolicy: "strict", // Options: "strict" (IP check) | "relaxed" (Country check) | "none"
  });

  if (!validation.isValid) {
    const response = NextResponse.redirect(new URL("/login?expired=true", req.url));
    response.cookies.delete("session_token");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"]
};
```

---

## 6. Rendering User Active Sessions UI

In any Client Component (e.g. `app/dashboard/settings/sessions/page.tsx`):

```tsx
"use client";

import { ActiveSessionsCard } from "next-session-guard/client";

export default function UserSessionsPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Device & Session Security</h1>
      <ActiveSessionsCard
        apiUrl="/api/sessions"
        enableRealtime={true}
        sseUrl="/api/sessions/sse"
        onRevoke={(sessionId) => console.log("Revoked session:", sessionId)}
      />
    </div>
  );
}
```

---

## Next Steps

- Explore [Architecture & Lifecycle](./architecture.md) to understand internal workflows.
- Integrate [Real-Time SSE Revocation](./realtime-sse.md) for live browser termination.
- Set up [Telegram SOC Suite](./telegram-soc.md) for incident response.
