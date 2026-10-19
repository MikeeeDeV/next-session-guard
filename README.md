# Next-Session-Guard 🛡️

> Enterprise-Grade Multi-Device Session Management, Real-Time SSE Remote Revocation, Session Hijacking Defense, and **Autonomous Telegram Admin SOC Suite** for **Next.js (App Router)**, **Prisma**, and **Drizzle ORM**.

[![Version](https://img.shields.io/badge/version-2.0.1-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14%2B%20%7C%2015%2B%20%7C%2016%2B-black?logo=next.js)](https://nextjs.org/)
[![Prisma & Drizzle](https://img.shields.io/badge/ORM-Prisma%20%7C%20Drizzle-2D3748?logo=prisma)](https://www.prisma.io/)
[![Realtime SSE](https://img.shields.io/badge/Realtime-SSE_Live_Kick-00C7B7?logo=fastapi&logoColor=white)](#-real-time-sse-live-browser-kick)
[![Tests Passing](https://img.shields.io/badge/tests-215%20passed-brightgreen.svg)](tests)
[![XERJ Corpus Hub](https://img.shields.io/badge/AI%20Reference-XERJ%20Corpus%20Hub-8A2BE2?logo=github)](https://github.com/xerj-org/xerj)

---

## 🌟 What is Next-Session-Guard?

Traditional authentication libraries leave you completely blind to where your users are logged in, allow stolen tokens to linger for weeks, and lack any instant mechanism to terminate an active compromise.

**Next-Session-Guard** elevates your authentication stack to **Enterprise Military-Grade Security**:

- 📱 **Multi-Device & Geolocation Tracking:** Automatically extracts OS, Browser, Device Type, IP, City, Country, and Lat/Long coordinates with zero external dependencies.
- ⚡ **Real-Time Live Browser Kick (SSE):** Remotely revoke any session from the admin panel or Telegram, and the attacker's open browser tab is **immediately locked and redirected to `/login` without waiting for page refreshes**.
- 🛡️ **Session Hijacking Protection (Fingerprint Binding):** Verifies request IP and geo-location against stored session signatures in middleware; auto-revokes compromised tokens instantly in **Strict (IP)** or **Relaxed (Country)** modes.
- 🔄 **Sliding Token Auto-Rotation:** Automatically cycles and renews session tokens during active use (e.g. every 24h) and blacklists old tokens at the Edge to defeat token leakage.
- 🧹 **Database Garbage Collection:** Built-in pruning engine with presets (**Monthly [30d]**, **Semi-Annual [180d]**, **Annual [365d]**, or **Manual**) to keep your database fast and lightweight.
- 🎛️ **Full GUI Admin SOC Dashboard (`<AdminSecurityPanel />`):** Interactive Security Operations Center GUI to inspect live sessions, tune security settings, run database cleanup, and simulate cyber attacks.
- 🎮 **Ready-to-Run Interactive Playground (`examples/playground`):** Test everything out-of-the-box with `cd examples/playground && npm run dev` (zero database setup required).
- 🗄️ **Universal Database Adapters:** Native support for **Prisma ORM**, **Drizzle ORM**, and high-speed **In-Memory** testing stores.
- 🤖 **Optional Telegram Admin SOC Suite (`next-session-guard/telegram`):** Private admin group lockdown, kinetic travel anomaly math (Mach velocity), compact 64-byte HMAC Action Vault, and Honeypot Ghost Mode.

---

## 🇸🇦 نبذة شاملة باللغة العربية (الإصدار 2.0.1)

مكتبة **Next-Session-Guard** هي نظام أمني متكامل لإدارة وتحصين جلسات المستخدمين في تطبيقات **Next.js (App Router)** مع دعم **Prisma** و **Drizzle ORM** ومحولات الذاكرة السريعة:

1. **تتبع الأجهزة والمواقع جغرافياً:** استخراج تلقائي لنظام التشغيل، المتصفح، الـ IP، والبلد مع أعلام الدول ومؤشرات النشاط اللحظي بدون أي مكتبات خارجية ثقيلة.
2. **الطرد اللحظي الحي عبر المتصفح (Realtime SSE Kick):** عند طرد أي جلسة من لوحة الإدارة أو التيليجرام، يتم إغلاق شاشة المتصفح فوراً وتوجيهه لصفحة تسجيل الدخول **دون انتظار أن يقوم المستخدم بعمل Refresh**.
3. **الحماية من اختطاف الجلسات (Session Hijacking Guard):** فحص ومطابقة IP أو بلد المستخدم في الميدلوير؛ إذا تم استخدام التوكن من شبكة أو موقع مختلف يتم إبطال الجلسة فوراً بنمطين:
   - **النمط الصارم (Strict):** مطابقة الـ IP حرفياً (تطبيقات البنوك والأنظمة المالية).
   - **النمط المرن (Relaxed):** مطابقة بلد المستخدم (مناسب لمستخدمي الهواتف الذين تتغير شبكاتهم باستمرار).
4. **التدوير التلقائي للتوكن (Token Auto-Rotation):** تجديد توكن الجلسة تلقائياً كل فترة محددة (مثل 24 ساعة) وحظر التوكن القديم لمنع استغلال التسريبات.
5. **طبقة كاش فائقة السرعة على الـ Edge (`next-session-guard/cache`):** فحص القائمة السوداء للتوكنات المبطّلة في أقل من 1 مللي ثانية باستخدام Memory Cache أو Upstash Redis أو Redis العادي دون استهلاك استعلامات قاعدة البيانات.
6. **فصل معمارية الـ Server والـ Client (`next-session-guard/server` & `/client`):** توافق كامل 100% مع معمارية Next.js 15 App Router، بحيث تعمل أدوات السيرفر بدون تحميل حزم React في الـ API Routes.
7. **جدول تنظيف قاعدة البيانات (Garbage Collector):** محرك تنظيف دوري مدمج يدعم جداول: **شهري (30 يوماً)**، **نصف سنوي (180 يوماً)**، **سنوي (365 يوماً)**، أو **يدوياً** بعدد أيام مخصص مع إمكانية التنفيذ المباشر من واجهة المستخدم (GUI).
8. **لوحة تحكم أمنية كاملة بواجهة رسومية (`<AdminSecurityPanel />`):** لوحة عمليات أمنية (SOC) رسومية جاهزة لإدارة الجلسات، تعديل الإعدادات، ومختبر لمحاكاة الهجمات واختبار الرد الآلي.
9. **تطبيق تجريبي عملي جاهز للتشغيل (`examples/playground`):** يمكنك تجربة كل شيء عملياً فوراً بكتابة `cd examples/playground && npm run dev` (بدون الحاجة لإنشاء قاعدة بيانات حقيقية بفضل محول الذاكرة).
10. **دعم متعدد لقواعد البيانات (Multi-ORM):** دعم رسمي لـ **Prisma** و **Drizzle ORM** ومحول الذاكرة **MemoryAdapter**.
11. **غرفة عمليات تيليجرام الأمنية (Telegram Admin SOC):** كشف السفر المستحيل فيزيائياً عبر معادلات السرعة المدارية، نظام HMAC المشفر للحد من 64 بايت، مانع إغراق الإشعارات، ووضع الشبح (Honeypot).

---

## 🚀 Installation

```bash
npm install next-session-guard
# or
pnpm add next-session-guard
# or
yarn add next-session-guard
```

### Peer Dependencies
```bash
npm install @prisma/client next react react-dom lucide-react
```

### 🧩 100% Modular Architecture (Zero Bloat)
The library is structured into completely independent, tree-shakable subpaths:

| Import Path | Description | External Dependencies |
| :--- | :--- | :--- |
| `next-session-guard` | Core Manager, Multi-ORM Adapters, and UI Components | Standard |
| `next-session-guard/server` | Server-only Engine (zero React hooks, safe for API Route Handlers & RSC) | Zero React dependency |
| `next-session-guard/client` | Client-only Components (`<ActiveSessionsCard />`, `<AdminSecurityPanel />`) | React & Lucide |
| `next-session-guard/realtime` | Server-Sent Events (SSE) Hub, browser live kick bridge, reconnect handlers | Zero dependencies |
| `next-session-guard/actions` | Next.js Server Actions for session fetching and revocation | Next.js runtime |
| `next-session-guard/cache` | Edge-ready In-Memory, Redis & Upstash token blacklisting adapters | Optional Redis/Upstash |
| `next-session-guard/telegram` | Telegram Admin SOC, Kinetic Travel, HMAC Action Vault | **100% Opt-in** subpath |

---

## 🎮 1. Ready-to-Run Interactive Playground

Experience the entire system in action in less than 10 seconds:

```bash
# From the repository root:
npm run build
cd examples/playground
npm run dev
```

Open your browser:
- 📱 **User Active Sessions & SSE Kick Listener:** [http://localhost:3000](http://localhost:3000)
- 🛡️ **Admin Security Operations Center (SOC) & Attack Simulator:** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🗄️ 2. Database Adapters (Prisma & Drizzle ORM)

### Option A: Prisma ORM

Add the session fields to `prisma/schema.prisma`:

```prisma
model Session {
  id           String    @id @default(cuid())
  sessionToken String    @unique
  userId       String
  expires      DateTime
  
  // ── Next-Session-Guard Extended Fields ──
  ipAddress    String?
  userAgent    String?   @db.Text
  deviceType   String?   // "desktop" | "mobile" | "tablet" | "unknown"
  browser      String?   // "Chrome" | "Safari" | "Firefox" | "Edge"
  os           String?   // "Windows" | "macOS" | "iOS" | "Android" | "Linux"
  city         String?   // e.g. "Cairo"
  country      String?   // e.g. "EG"
  lastActiveAt DateTime  @default(now())
  isRevoked    Boolean   @default(false)
  revokedAt    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([sessionToken])
}
```

Initialize `SessionManager`:
```typescript
import { prisma } from "@/lib/prisma";
// Import from "next-session-guard/server" for zero-client bundle overhead
import { SessionManager } from "next-session-guard/server";

export const sessionManager = new SessionManager(prisma, {
  maxConcurrentSessions: 5,
  hijackingProtection: "strict", // "strict" | "relaxed" | false
  tokenRotationIntervalSeconds: 86400, // Rotate token every 24 hours
});
```

### Option B: Drizzle ORM

```typescript
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { SessionManager, createDrizzleAdapter } from "next-session-guard/server";

const adapter = createDrizzleAdapter(db, sessions);
export const sessionManager = new SessionManager(adapter, {
  maxConcurrentSessions: 5,
});
```

### Option C: High-Speed In-Memory Adapter (Testing / Playground)

```typescript
import { SessionManager, createMemoryAdapter } from "next-session-guard/server";

// Instant zero-database evaluation with built-in Prisma-compatible interface
const memoryAdapter = createMemoryAdapter();
export const sessionManager = new SessionManager(memoryAdapter);
```

---

## ⚡ 3. Edge Blacklist Cache Adapters (`next-session-guard/cache`)

Offload repetitive session verification from your primary database. When sessions are revoked or auto-rotated, their tokens are immediately blacklisted in cache with **sub-millisecond (< 1ms)** lookup speeds:

```typescript
import { SessionManager } from "next-session-guard/server";
import { createMemoryAdapter } from "next-session-guard/cache";
// Or for serverless edge & multi-region clusters:
// import { createUpstashAdapter } from "next-session-guard/cache";
// import { createRedisAdapter } from "next-session-guard/cache";

const cache = createMemoryAdapter(); // Fast in-memory Map with auto-TTL cleanup

export const sessionManager = new SessionManager(prisma, {
  cacheAdapter: cache,
  maxConcurrentSessions: 5,
  hijackingProtection: "strict",
});
```

---

## 📡 4. Real-Time SSE Live Browser Kick

Eliminates the vulnerability where revoked sessions remain active until the user refreshes or navigates. When kicked from the Admin Panel or Telegram, the user's open tab is **instantly terminated**.

### Step 1: Create the SSE API Route
Create `app/api/sessions/sse/route.ts`:

```typescript
import { getSSEHub } from "next-session-guard/realtime";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId"); // Authenticated user ID

  return getSSEHub().createStreamResponse(userId);
}
```

### Step 2: Bridge Session Revocations to SSE
Attach the SSE bridge to your `SessionManager`:

```typescript
import { getSSEHub, createSSERevocationBridge } from "next-session-guard/realtime";

const sseHub = getSSEHub();
const sseBridge = createSSERevocationBridge(sseHub);

export const sessionManager = new SessionManager(prisma, {
  onSessionRevoked: (event) => {
    // Broadcast live revocation frame to all active browser windows!
    sseBridge(event);
  },
});
```

### Step 3: Listen in the Browser
```tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useLiveRevocationGuard(userId: string) {
  const router = useRouter();

  useEffect(() => {
    const es = new EventSource(`/api/sessions/sse?userId=${userId}`);
    es.addEventListener("session_revoked", () => {
      // Instant logout redirect
      router.push("/login?reason=session_revoked_remotely");
    });
    return () => es.close();
  }, [userId, router]);
}
```

---

## 🛡️ 5. Session Hijacking Protection (Fingerprint Binding)

Stop token-theft attacks at the Edge:

```typescript
export const sessionManager = new SessionManager(prisma, {
  // "strict": Request IP must match session IP (Fintech, Banking, Healthcare)
  // "relaxed": Country must match (Mobile-friendly, allows WiFi-to-cellular handover)
  // false: Disabled
  hijackingProtection: "strict",
});
```

In your Next.js `middleware.ts`:
```typescript
import { NextRequest } from "next/server";
import { sessionGuardMiddleware } from "next-session-guard";

export async function middleware(request: NextRequest) {
  return sessionGuardMiddleware(request, {
    sessionTokenCookieName: "next-auth.session-token",
    loginUrl: "/login",
    hijackingProtection: "strict",
    validateWithDb: async (token, ip, country) => {
      const result = await sessionManager.validateSessionWithHijackProtection(token, ip, country);
      return result.valid;
    },
  });
}
```

---

## 🧹 6. Scheduled Database Garbage Collection

Prevent session tables from growing unchecked with preset pruning policies:

```typescript
// 1. Monthly Cleanup (Delete sessions older than 30 days)
await sessionManager.cleanupExpiredSessions({ schedule: "monthly" });

// 2. Semi-Annual Cleanup (Delete sessions older than 180 days)
await sessionManager.cleanupExpiredSessions({ schedule: "semi-annual" });

// 3. Annual Cleanup (Delete sessions older than 365 days)
await sessionManager.cleanupExpiredSessions({ schedule: "annual" });

// 4. Custom Manual Retention
await sessionManager.cleanupExpiredSessions({
  schedule: "manual",
  retentionDays: 45,
  revokedOnly: true, // Only purge revoked sessions, keep natural expirations
  batchSize: 5000,   // Prevent database transaction locks
});
```

### Automated Vercel / Node.js Cron Route
Create `app/api/cron/cleanup/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { sessionManager } from "@/lib/session";

export async function GET(req: Request) {
  // Verify CRON_SECRET header from Vercel or cloud scheduler
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await sessionManager.cleanupExpiredSessions({ schedule: "monthly" });
  return NextResponse.json({ success: true, result });
}
```

---

## 🔄 7. Sliding Token Auto-Rotation

Prevent replay attacks by periodically rotating session tokens:

```typescript
export const sessionManager = new SessionManager(prisma, {
  // Regenerate token every 24 hours of active usage
  tokenRotationIntervalSeconds: 86400,
});
```

When validating sessions, `validateSessionWithHijackProtection` automatically issues a fresh token and blacklists the retired token.

---

## 🎛️ 8. Admin Security Operations Center (SOC) GUI

Drop the enterprise `<AdminSecurityPanel />` into your admin portal:

```tsx
"use client";
// Import from "next-session-guard/client" or "next-session-guard"
import { AdminSecurityPanel } from "next-session-guard/client";

export default function AdminPage() {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <AdminSecurityPanel
        title="Session Security Operations Center"
        locale="en" // or "ar" for Arabic
        sseEndpoint="/api/sessions/sse"
        apiEndpoints={{
          getSessions: "/api/sessions",
          revokeSession: "/api/sessions",
          cleanup: "/api/admin/cleanup",
        }}
      />
    </div>
  );
}
```

### What You Get in the GUI:
- 📊 **Real-time Metrics:** Live active sessions, stopped hijack attempts, auto-rotations count, and SSE connection pulse.
- 💻 **Active Sessions Inspector:** Geo-flags, device badges, IP inspection, and 1-click **Live Remote Kick**.
- ⚙️ **Visual Settings Studio:** Toggle Hijacking Protection, change Token Rotation intervals, select Garbage Collection schedules, and trigger **Run Cleanup Now** with live count feedback.
- 🧪 **Interactive Cyber Simulation Lab:** Test IP Hijacking detection, simulate Impossible Travel math, test Token Auto-Rotation, and fire SSE Live Kicks with live terminal audit logs.

---

## 🤖 9. Telegram Admin SOC Security Suite

Run a private Security Operations Center right inside your Telegram admin group:

```typescript
import { createTelegramAdminGuard } from "next-session-guard/telegram";

export const adminGuard = createTelegramAdminGuard({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  adminGroupId: process.env.TELEGRAM_ADMIN_GROUP_ID!,
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
  minRiskScore: 40, // Ignore low-risk alerts
  enableKineticTravel: true,
  enableIncidentDamper: true,
});

export const sessionManager = new SessionManager(prisma, {
  onNewDeviceDetected: adminGuard.onNewDeviceDetected,
});
```

### Webhook Route (`app/api/telegram/webhook/route.ts`):
```typescript
import { createTelegramAdminWebhookHandler } from "next-session-guard/telegram";
import { sessionManager, adminGuard } from "@/lib/session";

export const POST = createTelegramAdminWebhookHandler({
  config: {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    adminGroupId: process.env.TELEGRAM_ADMIN_GROUP_ID!,
    secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
    actionSecret: process.env.TELEGRAM_ACTION_SECRET,
  },
  sessionManager,
  vault: adminGuard.vault,
});
```

### Key SOC Inventions:
- 🔒 **Admin Group Lockdown:** Strictly ignores and rejects any messages or button callbacks outside your configured `adminGroupId`.
- ✈️ **Kinetic Impossible Travel:** Uses spherical trigonometry (Haversine Formula) to calculate physical velocity between consecutive logins. Velocity exceeding commercial air travel (950 km/h) automatically flags an anomaly with calculated Mach speed.
- 🔐 **64-Byte HMAC Action Vault:** Solves Telegram's strict 64-byte `callback_data` limit by compressing action intents into cryptographically signed, short-lived tokens protected against replay attacks.
- 🌊 **Incident Damper (Anti-Flood):** Collapses credential stuffing and botnet bursts into a single live-updating alert card to prevent alert fatigue and Telegram rate limits.
- 👻 **Ghost / Honeypot Mode:** Tag a suspicious session as a ghost to silently trace attacker actions while withholding sensitive administrative powers.

---

## 🎨 10. User-Facing React Component (`<ActiveSessionsCard />`)

Drop this component into your user account settings page:

```tsx
"use client";
// Import from "next-session-guard/client" or "next-session-guard"
import { ActiveSessionsCard } from "next-session-guard/client";

export default function AccountSecurityPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <ActiveSessionsCard
        locale="en" // or "ar" for Arabic RTL
        sessionsApiEndpoint="/api/sessions"
        revokeOthersApiEndpoint="/api/sessions/revoke-others"
      />
    </div>
  );
}
```

---

## 🧪 Comprehensive Test Suite

Next-Session-Guard is battle-tested with **215 automated unit & integration tests** across 18 test files:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run coverage
```

---

## 📁 Repository Structure

```
next-session-guard/
├── examples/
│   └── playground/                # 🎮 Complete ready-to-run Next.js demo app
├── prisma/
│   └── schema.prisma              # Database Session schema
├── src/
│   ├── client.ts                  # 🎨 Client components entry ('use client' for Next.js App Router)
│   ├── server.ts                  # ⚙️ Server-only engine entry (zero React hooks, safe for API routes & RSC)
│   ├── index.ts                   # Universal package root export
│   ├── actions/                   # Next.js Server Actions
│   ├── api/                       # App Router API route helpers
│   ├── cache/                     # Redis, Upstash & Memory Edge cache adapters
│   ├── components/
│   │   ├── ActiveSessionsCard.tsx # User-facing session list component
│   │   └── AdminSecurityPanel.tsx # 🎛️ Full SOC Admin Dashboard GUI
│   ├── core/
│   │   ├── adapters.ts            # Multi-ORM adapters (Prisma, Drizzle, Memory)
│   │   ├── session-manager.ts     # Core engine (Rotation, Hijacking, GC)
│   │   ├── ua-parser.ts           # Zero-dependency OS/Browser/IP parser
│   │   └── types.ts               # Core TypeScript definitions
│   ├── middleware/                # Edge/Node session guard middleware
│   ├── realtime/                  # 📡 Real-time SSE Hub & Live Kick bridge
│   └── telegram/                  # 🛡️ Telegram Admin SOC Security Suite
│       ├── action-vault.ts        # 64-byte HMAC safe vault
│       ├── ghost-mode.ts          # Honeypot / Ghost session tagging
│       ├── incident-damper.ts     # Anti-flood attack aggregator
│       ├── kinetic-travel.ts      # Haversine distance & velocity math
│       ├── notifier.ts            # Telegram Bot API formatting & cards
│       ├── risk-engine.ts         # Dynamic threat scoring (0-100)
│       └── webhook.ts             # Strict lockdown webhook POST handler
└── tests/                         # 215 automated unit & integration tests
```

---

## 📄 License

Distributed under the **MIT License**. Created by **Mohamed Ayman**.
