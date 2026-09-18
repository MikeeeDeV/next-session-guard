# Next-Session-Guard 🛡️

> Production-ready multi-device session tracking, remote session revocation, and active device management for **Next.js (App Router)** & **Prisma**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14%2B%20%7C%2015%2B%20%7C%2016%2B-black?logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/)

---

## 📖 English Summary

Modern authentication libraries (such as NextAuth / Auth.js) often rely on stateless JWTs. While fast, they make it impossible to know which devices are logged in or revoke access when a device is lost or compromised.

**Next-Session-Guard** bridges this gap by providing:
- 📱 **Multi-Device & Browser Tracking:** Automatically parses OS, Browser, Device Type, and IP address.
- 🚫 **Remote Session Revocation:** End a single device session or "Sign out of all other devices" in 1-click.
- ⚡ **Zero-Dependency UA Parser:** Lightweight, Edge-compatible client metadata parser without bulky regex libraries.
- ⏱️ **Activity Throttling:** Non-blocking `lastActiveAt` touch updates to keep your database performant.
- 🔢 **Concurrent Session Limits:** Enforce maximum simultaneous logins per account (e.g., max 3 active devices).
- 🎨 **Drop-in React Component:** Polished, responsive, dark-mode ready active sessions management card (Tailwind + Lucide) supporting **English** and **Arabic (RTL)** out of the box.

---

## 🇸🇦 نبذة بالعربية

توفر **Next-Session-Guard** حلاً متكاملاً لإدارة جلسات المستخدمين على الأجهزة المختلفة في تطبيقات **Next.js (App Router)** مع **Prisma**:
1. **تتبع الأجهزة النشطة:** تسجيل المتصفح، نظام التشغيل، ونوع الجهاز (موبايل، تابلت، حاسوب)، وعنوان IP.
2. **إنهاء الجلسات عن بُعد (Remote Revocation):** إمكانية قيام المستخدم بإنهاء أي جلسة مشبوهة أو تسجيل الخروج من كافة الأجهزة الأخرى بضغطة واحدة.
3. **تحديد عدد الأجهزة المتزامنة (Concurrent Sessions Limit):** منع الحساب من الفتح على أكثر من عدد محدد من الأجهزة في وقت واحد.
4. **مكون واجهة جاهز (ActiveSessionsCard):** كارت عصري يدعم الوضع الليلي والنهاري واللغتين العربية والإنجليزية.

---

## 🚀 Quick Start

### 1. Update your Prisma Schema

Add the extended fields to your `Session` model in `prisma/schema.prisma`:

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  sessions  Session[]
}

model Session {
  id           String    @id @default(cuid())
  sessionToken String    @unique
  userId       String
  expires      DateTime
  
  // ── Next-Session-Guard Fields ──
  ipAddress    String?
  userAgent    String?   @db.Text
  deviceType   String?   // "desktop" | "mobile" | "tablet"
  browser      String?   // "Chrome" | "Safari" | "Edge" | etc.
  os           String?   // "Windows" | "macOS" | "iOS" | "Android"
  lastActiveAt DateTime  @default(now())
  isRevoked    Boolean   @default(false)
  revokedAt    DateTime?
  createdAt    DateTime  @default(now())

  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRevoked])
  @@index([sessionToken])
}
```

Run migration:
```bash
npx prisma db push
# or: npx prisma migrate dev --name add_session_guard_fields
```

---

### 2. Add the API Route Handlers

#### `src/app/api/sessions/route.ts`
```ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth"; // Your NextAuth / auth session resolver
import { createSessionsRouteHandlers } from "next-session-guard";

const handlers = createSessionsRouteHandlers(
  () => prisma,
  async (req: NextRequest) => {
    const session = await auth();
    if (!session?.user?.id) return null;
    return { id: session.user.id, sessionToken: (session as any).sessionToken };
  }
);

export const GET = handlers.GET;
export const DELETE = handlers.DELETE;
```

#### `src/app/api/sessions/revoke-others/route.ts`
```ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createRevokeOthersHandler } from "next-session-guard";

export const POST = createRevokeOthersHandler(
  () => prisma,
  async (req: NextRequest) => {
    const session = await auth();
    if (!session?.user?.id) return null;
    return { id: session.user.id, sessionToken: (session as any).sessionToken };
  }
);
```

---

### 3. Add the UI Component to User Settings

Place `<ActiveSessionsCard />` in your settings, profile, or account security page:

```tsx
import { ActiveSessionsCard } from "next-session-guard";

export default function SecuritySettingsPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Account Security</h1>
      
      {/* English */}
      <ActiveSessionsCard locale="en" />

      {/* Or Arabic with native RTL */}
      {/* <ActiveSessionsCard locale="ar" /> */}
    </div>
  );
}
```

---

## ⚙️ Core Engine API (`SessionManager`)

If you want to use the session manager directly in your server actions or auth callbacks:

```ts
import { SessionManager } from "next-session-guard";
import { prisma } from "@/lib/prisma";

const sessionManager = new SessionManager(prisma, {
  maxConcurrentSessions: 3, // Automatically log out the oldest session if > 3
  sessionDurationDays: 30,  // Session expiry window
  activityThrottleSeconds: 300, // Update lastActiveAt at most once every 5 minutes
});

// 1. Create a session on login
await sessionManager.createSession({
  userId: user.id,
  req: request, // Extracts IP & user-agent automatically
});

// 2. Validate session & check if revoked
const { valid, reason } = await sessionManager.validateSession(token);

// 3. Revoke single or all other sessions
await sessionManager.revokeSession({ sessionId, userId });
await sessionManager.revokeOtherSessions({ userId, currentSessionToken: token });
```

---

## 🔒 NextAuth / Auth.js Integration Example

When using database sessions or hybrid JWT validation:

```ts
// Inside auth.ts / signIn callback:
async signIn({ user }) {
  const sessionManager = new SessionManager(prisma, { maxConcurrentSessions: 2 });
  // You can enforce limits or track session here
  return true;
}
```

---

## 📁 Project Structure

```
next-session-guard/
├── README.md                      # Comprehensive documentation
├── LICENSE                        # MIT License
├── package.json                   # Dependencies and package metadata
├── tsconfig.json                  # TypeScript bundler configuration
├── prisma/
│   └── schema.prisma              # Extended Prisma session model
└── src/
    ├── core/
    │   ├── session-manager.ts     # Core business logic (Create, Validate, Revoke)
    │   ├── ua-parser.ts           # Zero-dependency OS, Browser, Device & IP parser
    │   └── types.ts               # TypeScript interfaces & DTOs
    ├── api/
    │   ├── route-sessions.ts      # GET & DELETE App Router route helpers
    │   └── route-revoke-others.ts # POST revoke-others handler
    ├── components/
    │   └── ActiveSessionsCard.tsx # Drop-in React UI Card (Tailwind + Lucide)
    ├── middleware/
    │   └── session-guard.ts       # Edge/Node middleware validation helper
    └── index.ts                   # Main package export entry point
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](https://github.com/) to propose new features or submit PRs.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
