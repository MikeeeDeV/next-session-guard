# Telegram Admin SOC Suite 🤖

Turn any private Telegram group into a real-time **Security Operations Center (SOC)**. The `next-session-guard/telegram` module enables automated incident response with interactive inline keyboard buttons (`/freeze`, `/kill`, `/allow`) directly from your phone.

---

## 🌟 Key Capabilities

- 🚨 **Instant Incident Alerts:** Receive notifications within 500ms of any hijacking attempt, impossible travel detection, or high-risk login.
- 💥 **1-Click Remote Remediation:** Terminate compromised sessions and blacklist attacker IPs with a single tap in Telegram.
- 🔐 **HMAC-SHA256 Action Vault:** Telegram limits callback data to **64 bytes**. Our Action Vault cryptographically packs and verifies actions using truncated HMAC signatures to prevent payload tampering and replay attacks.
- 🛡️ **Strict Group Lockdown:** Strictly verifies `X-Telegram-Bot-Api-Secret-Token` and ignores any messages or commands originating from outside your designated Admin Group.
- 🔇 **Adaptive Notification Damper:** Prevents notification flooding during volumetric attacks by intelligently aggregating alerts.

---

## 🛠️ Step 1: Telegram Bot & Group Setup

1. Open Telegram and message [@BotFather](https://t.me/BotFather) to create a new bot:
   ```
   /newbot
   Name: My NextJS Security SOC
   Username: my_nextjs_soc_bot
   ```
   Save the generated **Bot Token** (`TELEGRAM_BOT_TOKEN`).

2. Create a private Telegram Group (e.g. `Security SOC Ops`) and add your bot as an Administrator.

3. Obtain your Group Chat ID by sending a test message to the group and visiting:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
   Look for `"chat":{"id": -100xxxxxxxxxx}`.

---

## 🛠️ Step 2: Environment Variables

Add the following credentials to your `.env.local` or production environment:

```ini
TELEGRAM_BOT_TOKEN="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
TELEGRAM_ADMIN_CHAT_ID="-1001234567890"
TELEGRAM_WEBHOOK_SECRET="super_secret_webhook_random_string_32_bytes"
HMAC_VAULT_SECRET="another_secure_cryptographic_secret_key"
```

---

## 🛠️ Step 3: Implement Webhook Route Handler

Create `app/api/telegram/webhook/route.ts`:

```typescript
// app/api/telegram/webhook/route.ts
import { NextResponse } from "next/server";
import { handleTelegramWebhook } from "next-session-guard/telegram";
import { sessionManager } from "@/lib/session";

export async function POST(req: Request) {
  const result = await handleTelegramWebhook(req, {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID!,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET!,
    vaultSecret: process.env.HMAC_VAULT_SECRET!,
    onAction: async (action, payload) => {
      // Handle interactive button callbacks
      if (action === "kill_session") {
        await sessionManager.revokeSession(payload.sessionId);
        return { success: true, message: "💥 Session terminated & IP blacklisted." };
      }

      if (action === "freeze_session") {
        // Custom freeze logic
        return { success: true, message: "🔒 Session frozen for 24h." };
      }

      if (action === "allow_session") {
        return { success: true, message: "✅ Marked as false positive." };
      }

      return { success: false, message: "Unknown action." };
    }
  });

  return NextResponse.json(result);
}
```

---

## 🛠️ Step 4: Register Webhook with Telegram

Register your Next.js route with Telegram via `curl`:

```bash
curl -F "url=https://your-domain.com/api/telegram/webhook" \
     -F "secret_token=super_secret_webhook_random_string_32_bytes" \
     https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

---

## 📲 Alert Format Preview

When an impossible travel anomaly occurs, your SOC group receives an alert formatted as follows:

```
🚨 CRITICAL SECURITY ALERT: Impossible Travel
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User ID: usr_9942a1bc (admin@acme.com)
✈️ Anomaly: Tokyo 🇯🇵 ➔ London 🇬🇧
⚡ Velocity: 14,200 km/h (Mach 11.5)
⏱️ Time Delta: 4 minutes
💻 Device: Chrome 124 on Windows 11
🌐 Suspect IP: 185.220.101.4

[💥 Kill Session]  [🔒 Freeze 24h]  [✅ Allow]
```

Clicking **[💥 Kill Session]** immediately revokes the session in the database, blacklists the token in the Edge cache, and sends an SSE kick to terminate the attacker's open browser session in real time.
