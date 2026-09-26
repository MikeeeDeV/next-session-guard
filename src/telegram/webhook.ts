import * as crypto from "crypto";
import { ActionVault } from "./action-vault";
import { markSessionAsGhost } from "./ghost-mode";
import { TelegramNotifier } from "./notifier";
import { TelegramAdminInfo, TelegramWebhookHandlerConfig } from "./types";

/**
 * Creates a production-ready Next.js App Router POST handler for Telegram Webhook
 */
export function createTelegramAdminWebhookHandler(
  config: TelegramWebhookHandlerConfig,
  vaultInstance?: ActionVault
) {
  const vault = vaultInstance || new ActionVault(config.actionSecret);
  const notifier = new TelegramNotifier(config, vault);

  return async function POST(req: Request): Promise<Response> {
    try {
      // 1. Strict Webhook Secret Token Verification
      if (config.secretToken) {
        const receivedToken = req.headers.get("x-telegram-bot-api-secret-token") || "";
        if (!timingSafeCompare(receivedToken, config.secretToken)) {
          console.warn("[SessionGuard:Telegram] Unauthorized webhook call: invalid secret token");
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // 2. Parse Telegram Update
      const body = await req.json().catch(() => null);
      if (!body) {
        return new Response(JSON.stringify({ ok: false, error: "Bad Request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // ── Handle Callback Query (Interactive Button Clicks) ──
      if (body.callback_query) {
        await handleCallbackQuery(body.callback_query, config, vault, notifier);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // ── Handle Messages & Admin Commands ───────────────────
      if (body.message) {
        await handleAdminMessage(body.message, config, notifier);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[SessionGuard:Telegram] Error processing webhook:", err);
      // Return 200 to prevent Telegram from infinitely retrying crashed payloads
      return new Response(JSON.stringify({ ok: false, error: "Internal Error" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}

/**
 * Handles Interactive Button Clicks from the Admin Group
 */
async function handleCallbackQuery(
  query: any,
  config: TelegramWebhookHandlerConfig,
  vault: ActionVault,
  notifier: TelegramNotifier
): Promise<void> {
  const queryId = query.id;
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const data = query.data || "";

  // 1. Strict Admin Group Lockdown
  if (String(chatId) !== String(config.adminGroupId)) {
    console.warn(`[SessionGuard:Telegram] Rejected callback from unauthorized chat: ${chatId}`);
    await notifier.answerCallbackQuery(queryId, "⛔ Access Denied: Unauthorized chat.", true);
    return;
  }

  // 2. Check Allowed Admin User IDs
  const from = query.from;
  const adminInfo: TelegramAdminInfo = {
    id: from.id,
    username: from.username,
    firstName: from.first_name || "Admin",
    lastName: from.last_name,
  };

  if (
    config.allowedAdminUserIds &&
    config.allowedAdminUserIds.length > 0 &&
    !config.allowedAdminUserIds.map(String).includes(String(adminInfo.id))
  ) {
    await notifier.answerCallbackQuery(
      queryId,
      "⛔ Access Denied: Your Telegram user ID is not on the SOC Admin whitelist.",
      true
    );
    return;
  }

  // 3. Verify and Extract Action from Ephemeral Vault
  const verification = vault.verifyAndGet(data);
  if (!verification.valid || !verification.action) {
    const errorMsg =
      verification.reason === "action_expired"
        ? "⚠️ This action has expired (15-min limit)."
        : verification.reason === "action_already_used"
        ? "ℹ️ This action has already been executed."
        : "⚠️ Invalid or stale action button.";

    await notifier.answerCallbackQuery(queryId, errorMsg, true);
    if (chatId && messageId) {
      await notifier.neutralizeMessage(chatId, messageId);
    }
    return;
  }

  const action = verification.action;
  const adminDisplayName = adminInfo.username ? `@${adminInfo.username}` : adminInfo.firstName;

  // 4. Dual-Admin Quorum Verification
  if (action.requiredQuorum > 1) {
    const quorumState = vault.registerApproval(action, adminInfo);
    if (!quorumState.quorumReached) {
      await notifier.answerCallbackQuery(
        queryId,
        `⏳ Step 1/2 Confirmed by ${adminDisplayName}. Awaiting 2nd Admin approval.`,
        true
      );
      return;
    }
  }

  // 5. Execute Action
  vault.consume(action.id);

  try {
    switch (action.type) {
      case "revoke_session": {
        if (action.sessionId) {
          await config.sessionManager.revokeSession({
            sessionId: action.sessionId,
            userId: action.userId,
          });
        }
        await notifier.answerCallbackQuery(
          queryId,
          `✅ Session ${action.sessionId || ""} successfully revoked and blocked!`,
          true
        );
        if (chatId && messageId) {
          await notifier.neutralizeMessage(
            chatId,
            messageId,
            `🛑 <b>Session Revoked</b> by ${adminDisplayName} at ${new Date().toISOString()}`
          );
        }
        break;
      }

      case "ghost_session": {
        if (action.sessionId) {
          markSessionAsGhost(action.sessionId, action.userId, adminDisplayName);
          if (config.onGhostSession) {
            await config.onGhostSession(action.sessionId, action.userId, adminInfo);
          }
        }
        await notifier.answerCallbackQuery(
          queryId,
          `👻 Honeypot Active: Session ${action.sessionId} tagged as Ghost. Forensics recording engaged.`,
          true
        );
        if (chatId && messageId) {
          await notifier.neutralizeMessage(
            chatId,
            messageId,
            `👻 <b>Honeypot Ghost Active</b> by ${adminDisplayName} at ${new Date().toISOString()}`
          );
        }
        break;
      }

      case "revoke_all": {
        await config.sessionManager.revokeAllSessions(action.userId);
        await notifier.answerCallbackQuery(
          queryId,
          `👥 All active sessions for user ${action.userId} have been terminated!`,
          true
        );
        if (chatId && messageId) {
          await notifier.neutralizeMessage(
            chatId,
            messageId,
            `👥 <b>All Sessions Terminated</b> for <code>${action.userId}</code> by ${adminDisplayName}`
          );
        }
        break;
      }

      case "suspend_user": {
        await config.sessionManager.revokeAllSessions(action.userId);
        if (config.onSuspendUser) {
          await config.onSuspendUser(action.userId, adminInfo);
        }
        await notifier.answerCallbackQuery(
          queryId,
          `⛔ User ${action.userId} suspended and locked down!`,
          true
        );
        if (chatId && messageId) {
          await notifier.neutralizeMessage(
            chatId,
            messageId,
            `⛔ <b>User Suspended & Locked</b>: <code>${action.userId}</code> (Approved by ${adminDisplayName})`
          );
        }
        break;
      }

      case "dismiss": {
        await notifier.answerCallbackQuery(queryId, "✅ Alert dismissed.");
        if (chatId && messageId) {
          await notifier.neutralizeMessage(
            chatId,
            messageId,
            `✅ <i>Alert marked as False Positive / Dismissed by ${adminDisplayName}</i>`
          );
        }
        break;
      }
    }
  } catch (executionErr) {
    console.error("[SessionGuard:Telegram] Error executing admin action:", executionErr);
    await notifier.answerCallbackQuery(
      queryId,
      "❌ Failed to execute action due to a server error.",
      true
    );
  }
}

/**
 * Handles Text Commands sent by Admins in the Group
 */
async function handleAdminMessage(
  msg: any,
  config: TelegramWebhookHandlerConfig,
  notifier: TelegramNotifier
): Promise<void> {
  const chatId = msg.chat?.id;
  const text = (msg.text || "").trim();

  // Strict Admin Group Lockdown
  if (String(chatId) !== String(config.adminGroupId)) {
    return;
  }

  if (text.startsWith("/status") || text.startsWith("/stats")) {
    const responseText = [
      `🛡️ <b>[NextSessionGuard SOC Status]</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `✅ <b>System Health:</b> Operational`,
      `🔒 <b>Group Lockdown:</b> Active (Chat: <code>${chatId}</code>)`,
      `⚡ <b>Kinetic Travel:</b> ${config.enableKineticTravel !== false ? "Enabled" : "Disabled"}`,
      `🛡️ <b>Incident Damper:</b> ${config.enableIncidentDamper !== false ? "Enabled" : "Disabled"}`,
      `⏱️ <b>Action TTL:</b> ${config.actionTtlSeconds ?? 900}s`,
    ].join("\n");

    await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: responseText,
        parse_mode: "HTML",
      }),
    });
  } else if (text.startsWith("/revoke ")) {
    const parts = text.split(" ");
    const sessionId = parts[1]?.trim();
    if (!sessionId) return;

    try {
      const session = await (config.sessionManager as any).prisma.session.findUnique({
        where: { id: sessionId },
      });
      if (session) {
        await config.sessionManager.revokeSession({ sessionId, userId: session.userId });
      }
      await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ Session <code>${sessionId}</code> revoked successfully.`,
          parse_mode: "HTML",
        }),
      });
    } catch (err: any) {
      await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `❌ Error revoking session: ${err?.message || "Unknown error"}`,
          parse_mode: "HTML",
        }),
      });
    }
  } else if (text.startsWith("/killall ")) {
    const parts = text.split(" ");
    const userId = parts[1]?.trim();
    if (!userId) return;

    try {
      await config.sessionManager.revokeAllSessions(userId);
      await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `👥 All sessions for user <code>${userId}</code> have been revoked.`,
          parse_mode: "HTML",
        }),
      });
    } catch (err: any) {
      await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `❌ Error revoking user sessions: ${err?.message || "Unknown error"}`,
          parse_mode: "HTML",
        }),
      });
    }
  }
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
