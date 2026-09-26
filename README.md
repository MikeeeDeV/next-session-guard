# Next-Session-Guard 🛡️

> Production-ready multi-device session tracking, remote session revocation, and **Military-Grade Telegram Admin SOC Security Operations Suite** for **Next.js (App Router)** & **Prisma**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14%2B%20%7C%2015%2B%20%7C%2016%2B-black?logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![Telegram SOC](https://img.shields.io/badge/Telegram-Admin_SOC_Guard-2CA5E0?logo=telegram&logoColor=white)](#-telegram-admin-soc-security-suite)
[![Tests Passing](https://img.shields.io/badge/tests-164%20passed-brightgreen.svg)](tests)

---

## 🌟 What is Next-Session-Guard?

Traditional authentication systems (JWTs or basic database sessions) often leave you blind to where your users are logged in, and give administrators zero interactive controls to intercept ongoing account takeovers.

**Next-Session-Guard** transforms standard Next.js authentication into a high-security platform with:
- 📱 **Multi-Device & Browser Tracking:** Auto-extracts OS, Browser, Device Type, Geolocation, and IP address.
- 🚫 **Remote Session Revocation:** End individual device sessions or "Sign out of all other devices" in 1-click.
- ⚡ **Sub-Millisecond Edge Blacklisting:** Edge-ready Redis & Upstash cache adapters to revoke tokens instantly before hitting the database.
- 🎨 **Drop-in React Component (`<ActiveSessionsCard />`):** Dark/Light mode, multi-language (English & Arabic RTL).
- 🛡️ **Military-Grade Telegram Admin SOC Suite (`next-session-guard/telegram`):** An autonomous Security Operations Center running directly inside your private Telegram Admin Group.

---

## 🇸🇦 نبذة باللغة العربية

مكتبة **Next-Session-Guard** تقدم حلاً أمنياً متكاملاً لإدارة الجلسات في تطبيقات **Next.js** مع **Prisma**:
1. **تتبع الأجهزة والنشاط:** رصد تفصيلي لنوع الجهاز (حاسوب، هاتف، تابلت)، المتصفح، نظام التشغيل، الـ IP، والموقع الجغرافي.
2. **إنهاء الجلسات عن بُعد:** إمكانية طرد أي جهاز بضغطة زر وتحديث الكاش لحظياً لمنع استخدام التوكن في الميدلوير.
3. **غرفة عمليات أمنية عبر تيليجرام (Admin SOC Suite):**
   - حصر صارم في **جروب الإدارة الخاص** فقط لمنع أي وصول غير مصرح به.
   - كشف **السفر المستحيل فيزيائياً (Kinetic Impossible Travel)** بحساب المسافة والسرعة بمعادلة هافرسين.
   - تقييم المخاطر التلقائي من 0 إلى 100 (**Dynamic Risk Scoring**).
   - خزان الأوامر المشفر المضغوط (**Action Vault**) لحل معضلة حد الـ 64 بايت في تيليجرام ومنع هجمات التكرار (Replay Attacks).
   - مكوك الطوارئ ضد الإغراق (**Incident Damper**) لتجميع الهجمات ومنع حظر البوت والـ Alert Fatigue.
   - مصيدة الجلسات الشبحية (**Ghost / Honeypot Mode**) لمراقبة المخترق سراً وجمع الأدلة.
   - نظام **الموافقة الثنائية للأدمنز (Dual-Admin Quorum)** للعمليات الحساسة (مثل تجميد المستخدم).

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
Ensure you have the required peer dependencies installed:
```bash
npm install @prisma/client next react react-dom lucide-react
```

### 🧩 100% Modular Architecture (Telegram is Completely Optional)
The core library has **zero dependencies on Telegram**:
- **Without Telegram (Core Mode):** Use `next-session-guard` for device tracking, concurrent session limits, and UI components. Nothing related to Telegram is ever imported or executed.
- **With Telegram (Admin SOC Mode):** Opt-in by importing specifically from `next-session-guard/telegram`.

| Import Path | Purpose | Overhead / Dependencies |
| :--- | :--- | :--- |
| `next-session-guard` | Core Session Manager, Middleware, UA Parser, UI Card | Standard (~52 KB, zero external network calls) |
| `next-session-guard/actions` | Next.js Server Actions for session revocation | Standalone Next.js Server Actions |
| `next-session-guard/cache` | Redis / Upstash Edge blacklist adapters | Optional Cache Adapter |
| `next-session-guard/telegram` | Telegram Admin SOC, Webhook & Kinetic Threat Engine | **100% Opt-in** (isolated subpath) |

---

## 🗄️ 1. Prisma Schema Setup

Add the required session fields to your `prisma/schema.prisma`:

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
  
  // ── Next-Session-Guard Extended Fields ──
  ipAddress    String?
  userAgent    String?   @db.Text
  deviceType   String?   // "desktop" | "mobile" | "tablet" | "unknown"
  browser      String?   // "Chrome" | "Safari" | "Firefox" | "Edge" | etc.
  os           String?   // "Windows" | "macOS" | "iOS" | "Android" | "Linux"
  city         String?   // e.g. "Cairo"
  country      String?   // e.g. "EG"
  lastActiveAt DateTime  @default(now())
  isRevoked    Boolean   @default(false)
  revokedAt    DateTime?
  createdAt    DateTime  @default(now())

  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRevoked])
  @@index([sessionToken])
}
```

Push schema updates to your database:
```bash
npx prisma db push
```

---

## 🛡️ Telegram Admin SOC Security Suite

The `next-session-guard/telegram` module turns a private Telegram group into an interactive, zero-latency Security Operations Center.

### Key Innovations:

| Innovation | What It Does | Why It's Critical |
| :--- | :--- | :--- |
| **Strict Group Lockdown** | Rejects any message or callback outside `adminGroupId`. | Guarantees external users or unauthorized chats cannot trigger actions. |
| **Compact Action Vault** | Encodes actions in ~16 bytes with HMAC-SHA256 & 15m TTL. | Defeats Telegram's 64-byte `callback_data` limit & blocks Replay Attacks. |
| **Kinetic Impossible Travel 2.0** | Calculates real km distance & speed via Haversine formula. | Flags supersonic physical leaps (e.g. 2,800 km in 10 mins = 16,800 km/h!). |
| **Dynamic Threat Scoring** | Analyzes Device, OS, IP, Cloud ASN & Location (0-100 score). | Categorizes incidents into `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. |
| **Incident Damper (Anti-Flood)** | Collapses rapid login spikes into a single live-updating card. | Prevents Telegram 429 rate limit bans and eliminates Alert Fatigue. |
| **Ghost Honeypot Mode** | Tags sessions for mock data/forensics without alerting attacker. | Allows observing hacker behavior silently instead of hard disconnect. |
| **Dual-Admin Quorum** | Requires 2 separate admins to approve destructive operations. | Prevents accidental or rogue account suspensions (`suspend_user`). |

---

### Step-by-Step Telegram Setup Guide

#### 1. Create a Bot with @BotFather
1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/newbot`, choose a name and username (e.g., `MyCompanySecurityBot`).
3. Copy your **Bot API Token** (e.g., `7123456789:AAH...`).

#### 2. Create your Private Admin Group & Get Chat ID
1. Create a new private Telegram Group (e.g., `SOC Security Room`).
2. Add your bot to the group and make it an **Administrator**.
3. Send a test message in the group.
4. Retrieve the Group Chat ID (starts with `-100...`) by visiting:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
   Look for `"chat":{"id":-100xxxxxxxxxx}`.

#### 3. Attach Telegram Guard to `SessionManager`

In your server-side session configuration (`lib/session-manager.ts`):

```typescript
import { SessionManager } from "next-session-guard";
import { createTelegramAdminGuard } from "next-session-guard/telegram";
import { prisma } from "@/lib/prisma";

// 1. Initialize the Telegram Admin Guard
export const adminGuard = createTelegramAdminGuard({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  adminGroupId: process.env.TELEGRAM_ADMIN_GROUP_ID!, // e.g. "-1001234567890"
  threadId: process.env.TELEGRAM_THREAD_ID ? Number(process.env.TELEGRAM_THREAD_ID) : undefined, // Optional forum topic
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET, // Recommended for webhook security
  minRiskScore: 30, // Send alerts for medium, high, and critical threats (0-100)
  enableKineticTravel: true,
  enableIncidentDamper: true,
  dualAdminQuorumActions: ["suspend_user", "revoke_all"],
  
  // Optional: Custom handler when an admin clicks "Suspend User"
  onSuspendUser: async (userId, admin) => {
    console.log(`User ${userId} suspended by @${admin.username}`);
    // e.g. await prisma.user.update({ where: { id: userId }, data: { isSuspended: true } });
  },
});

// 2. Pass listener to SessionManager
export const sessionManager = new SessionManager(prisma, {
  maxConcurrentSessions: 5,
  onNewDeviceDetected: adminGuard.onNewDeviceDetected,
});
```

---

#### 4. Setup the Interactive Telegram Webhook Route

Create the webhook route handler in your Next.js App Router:
`app/api/telegram-webhook/route.ts`

```typescript
import { createTelegramAdminWebhookHandler } from "next-session-guard/telegram";
import { sessionManager } from "@/lib/session-manager";

export const POST = createTelegramAdminWebhookHandler({
  sessionManager,
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  adminGroupId: process.env.TELEGRAM_ADMIN_GROUP_ID!,
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
  // Whitelist specific admin user IDs (optional):
  // allowedAdminUserIds: [123456789, 987654321],
});
```

#### 5. Register your Webhook with Telegram
Once deployed to your domain (or via tunneling during dev):
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/api/telegram-webhook",
    "secret_token": "your_secure_random_string_here"
  }'
```

---

### Telegram Interactive Incident Card Example

When a suspicious login occurs, the admin group instantly receives:

```
🛡️ [NextSessionGuard Security Incident]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User: usr_8923a1 (john@example.com)
💻 Device: Chrome on Windows 11 (desktop)
📍 Location: 🇩🇪 Frankfurt, Germany (IP: 142.250.190.46)
⏰ Detected At: 2026-09-26T12:35:10.000Z

⚠️ Threat Assessment: 🔴 CRITICAL (Level 4/4)
📊 Risk Score: 90/100 [██████████ 90%+]

Incident Factors:
• 🚀 Impossible Travel: 2,850 km at ~14,250 km/h (Cairo, Egypt ➔ Frankfurt, Germany)
• 🏢 Datacenter/Hosting provider IP: Google Cloud
• 🌐 New browser detected: Chrome

⚡ PHYSICAL ANOMALY:
🚀 Impossible Travel: 2,850 km in 12 mins (~14,250 km/h). Faster than commercial airliner!

[ 🛑 Revoke Session ]     [ 👻 Ghost Mode ]
[ 👥 Kill All User Sessions ]  [ ⛔ Suspend User ]
[ ✅ Dismiss Alert ]
```

### Admin Group Chat Commands

Authorized admins can also type commands directly in the group:
- `/status` or `/stats` — Displays current SOC health, lockdown state, and modules.
- `/revoke <sessionId>` — Revokes a specific session immediately.
- `/killall <userId>` — Terminates all active sessions for a target user.

---

## 💻 2. Standard Session Management Usage

### Creating Sessions on Login
```typescript
import { sessionManager } from "@/lib/session-manager";

export async function handleLogin(req: Request, user: { id: string }) {
  const session = await sessionManager.createSession({
    userId: user.id,
    req, // automatically extracts IP, User-Agent, City, Country
  });

  return session.sessionToken;
}
```

### Validating Sessions in Middleware
```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionGuardMiddleware } from "next-session-guard";
import { UpstashRedisAdapter } from "next-session-guard/cache";

const cache = new UpstashRedisAdapter({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const middleware = sessionGuardMiddleware({
  cookieName: "session-token",
  cacheAdapter: cache,
  loginUrl: "/login",
  publicPaths: ["/login", "/register", "/api/auth", "/api/telegram-webhook"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

---

## 🎨 3. Drop-in UI Component (`<ActiveSessionsCard />`)

Drop this component into your account settings page:

```tsx
import { ActiveSessionsCard } from "next-session-guard";

export default function SecurityPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* English */}
      <ActiveSessionsCard locale="en" />

      {/* Or Arabic with native RTL layout */}
      {/* <ActiveSessionsCard locale="ar" /> */}
    </div>
  );
}
```

---

## 🧪 Testing

The repository comes with a comprehensive Vitest test suite covering **164 automated unit & integration tests**:

```bash
# Run all tests once
npm test

# Run tests in interactive watch mode
npm run test:watch

# Run tests with code coverage report
npm run coverage
```

---

## 📁 Repository Structure

```
next-session-guard/
├── prisma/
│   └── schema.prisma              # Database Session schema
├── src/
│   ├── actions/                   # Next.js Server Actions
│   ├── api/                       # App Router API route handlers
│   ├── cache/                     # Redis & Upstash Edge cache adapters
│   ├── components/                # <ActiveSessionsCard /> React UI
│   ├── core/
│   │   ├── session-manager.ts     # Core session engine
│   │   ├── ua-parser.ts           # Zero-dependency OS/Browser/IP parser
│   │   └── types.ts               # Core types
│   ├── middleware/                # Edge/Node session guard middleware
│   └── telegram/                  # 🛡️ Telegram Admin SOC Security Suite
│       ├── action-vault.ts        # Ephemeral 64-byte safe HMAC vault
│       ├── ghost-mode.ts          # Honeypot / Ghost session tagging
│       ├── incident-damper.ts     # Anti-flood attack aggregator
│       ├── kinetic-travel.ts      # Haversine distance & speed calculator
│       ├── notifier.ts            # Telegram Bot API formatting & cards
│       ├── risk-engine.ts         # Dynamic threat scoring (0-100)
│       ├── types.ts               # SOC types & config
│       ├── webhook.ts             # Strict lockdown webhook POST handler
│       └── index.ts               # Telegram module entry point
└── tests/                         # 164 unit & integration tests
```

---

## 📄 License

Distributed under the **MIT License**.
