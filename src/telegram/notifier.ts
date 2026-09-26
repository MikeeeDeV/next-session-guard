import { ActionVault } from "./action-vault";
import { countryCodeToFlag } from "../core/ua-parser";
import { RiskAnalysis, TelegramAdminGuardConfig } from "./types";
import { NewDeviceContext } from "../core/types";

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramMessageResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat: { id: number | string };
  };
  description?: string;
}

export class TelegramNotifier {
  private botToken: string;
  private adminGroupId: string | number;
  private threadId?: number;
  private actionVault: ActionVault;
  private actionTtlSeconds: number;
  private dualAdminQuorumActions: string[];

  constructor(config: TelegramAdminGuardConfig, actionVault: ActionVault) {
    this.botToken = config.botToken;
    this.adminGroupId = config.adminGroupId;
    this.threadId = config.threadId;
    this.actionVault = actionVault;
    this.actionTtlSeconds = config.actionTtlSeconds ?? 900;
    this.dualAdminQuorumActions = config.dualAdminQuorumActions ?? ["revoke_all", "suspend_user"];
  }

  /**
   * Dispatches an incident alert card to the Admin Group
   */
  async sendSecurityAlert(
    context: NewDeviceContext,
    risk: RiskAnalysis
  ): Promise<TelegramMessageResponse | null> {
    const text = this.formatSecurityCard(context, risk);
    const keyboard = this.buildActionKeyboard(context);

    return this.sendMessage({
      chat_id: this.adminGroupId,
      message_thread_id: this.threadId,
      text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  }

  /**
   * Dispatches an aggregated burst incident card when under flood
   */
  async sendOrUpdateBurstCard(data: {
    messageId?: number;
    batchCount: number;
    topCountries: string[];
    sampleUserId: string;
  }): Promise<TelegramMessageResponse | null> {
    const text = [
      `🚨 <b>[ACTIVE ATTACK / BURST DETECTED]</b> 🚨`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚠️ <b>Rate anomaly:</b> Rapid influx of suspicious logins!`,
      `📊 <b>Incidents in window:</b> <code>${data.batchCount}</code> attempts`,
      `🌐 <b>Top Origin Regions:</b> ${data.topCountries.join(", ") || "Multiple"}`,
      `🎯 <b>Target Sample:</b> <code>${data.sampleUserId}</code>`,
      ``,
      `<i>Incoming alerts are automatically collapsed to protect Telegram rate limits.</i>`,
    ].join("\n");

    const keyboard: InlineKeyboardButton[][] = [
      [
        {
          text: "🛡️ Dismiss & Acknowledge",
          callback_data: this.actionVault.createAction({
            type: "dismiss",
            userId: data.sampleUserId,
            chatId: this.adminGroupId,
            ttlSeconds: 600,
          }).callbackData,
        },
      ],
    ];

    if (data.messageId) {
      return this.editMessageText({
        chat_id: this.adminGroupId,
        message_id: data.messageId,
        text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: keyboard },
      });
    }

    return this.sendMessage({
      chat_id: this.adminGroupId,
      message_thread_id: this.threadId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  /**
   * Neutralizes a message by removing its interactive buttons (Self-Neutralization)
   */
  async neutralizeMessage(
    chatId: string | number,
    messageId: number,
    resolvedText?: string
  ): Promise<void> {
    if (resolvedText) {
      await this.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: resolvedText,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
      });
    } else {
      await this.editMessageReplyMarkup({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      });
    }
  }

  /**
   * Calls Telegram Bot API answerCallbackQuery (displays native banner/modal)
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    text: string,
    showAlert: boolean = false
  ): Promise<void> {
    await this.callApi("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  }

  /**
   * Formats the incident card with clean HTML, risk indicators, and kinetic physics
   */
  private formatSecurityCard(context: NewDeviceContext, risk: RiskAnalysis): string {
    const { newSession, userId } = context;
    const flag = newSession.country ? countryCodeToFlag(newSession.country) : "🌐";
    const loc = [newSession.city, newSession.country].filter(Boolean).join(", ") || "Unknown";

    const riskBadges = {
      CRITICAL: "🔴 CRITICAL (Level 4/4)",
      HIGH: "🟠 HIGH (Level 3/4)",
      MEDIUM: "🟡 MEDIUM (Level 2/4)",
      LOW: "🟢 LOW (Level 1/4)",
    };

    const riskBars = {
      CRITICAL: "██████████ 90%+",
      HIGH: "███████░░░ 70%+",
      MEDIUM: "████░░░░░░ 40%+",
      LOW: "██░░░░░░░░ 20%",
    };

    const lines = [
      `🛡️ <b>[NextSessionGuard Security Incident]</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 <b>User:</b> <code>${userId}</code>`,
      `💻 <b>Device:</b> <code>${newSession.browser || "Unknown"}</code> on <code>${newSession.os || "Unknown"}</code> (${newSession.deviceType || "desktop"})`,
      `📍 <b>Location:</b> ${flag} ${loc} (IP: <code>${newSession.ipAddress || "Unknown"}</code>)`,
      `⏰ <b>Detected At:</b> <code>${new Date().toISOString()}</code>`,
      ``,
      `⚠️ <b>Threat Assessment:</b> ${riskBadges[risk.level]}`,
      `📊 <b>Risk Score:</b> <code>${risk.score}/100</code> [${riskBars[risk.level]}]`,
    ];

    if (risk.reasons.length > 0) {
      lines.push(``, `<b>Incident Factors:</b>`);
      for (const reason of risk.reasons) {
        lines.push(`• ${reason}`);
      }
    }

    if (risk.kinetic?.isImpossible) {
      lines.push(``, `⚡ <b>PHYSICAL ANOMALY:</b>`, `<code>${risk.kinetic.description}</code>`);
    }

    lines.push(
      ``,
      `<i>🔒 Actions strictly restricted to verified SOC administrators.</i>`
    );

    return lines.join("\n");
  }

  /**
   * Builds the compact inline keyboard for this incident
   */
  private buildActionKeyboard(context: NewDeviceContext): InlineKeyboardButton[][] {
    const { userId, sessionId } = context;

    // 1. Revoke This Session
    const revokeAction = this.actionVault.createAction({
      type: "revoke_session",
      sessionId,
      userId,
      chatId: this.adminGroupId,
      ttlSeconds: this.actionTtlSeconds,
    });

    // 2. Ghost Mode (Honeypot)
    const ghostAction = this.actionVault.createAction({
      type: "ghost_session",
      sessionId,
      userId,
      chatId: this.adminGroupId,
      ttlSeconds: this.actionTtlSeconds,
    });

    // 3. Suspend User (Quorum required)
    const suspendAction = this.actionVault.createAction({
      type: "suspend_user",
      userId,
      chatId: this.adminGroupId,
      ttlSeconds: this.actionTtlSeconds,
      requiredQuorum: this.dualAdminQuorumActions.includes("suspend_user") ? 2 : 1,
    });

    // 4. Revoke All Sessions for this user (Quorum required)
    const revokeAllAction = this.actionVault.createAction({
      type: "revoke_all",
      userId,
      chatId: this.adminGroupId,
      ttlSeconds: this.actionTtlSeconds,
      requiredQuorum: this.dualAdminQuorumActions.includes("revoke_all") ? 2 : 1,
    });

    // 5. Dismiss
    const dismissAction = this.actionVault.createAction({
      type: "dismiss",
      userId,
      chatId: this.adminGroupId,
      ttlSeconds: this.actionTtlSeconds,
    });

    return [
      [
        { text: "🛑 Revoke Session", callback_data: revokeAction.callbackData },
        { text: "👻 Ghost Mode", callback_data: ghostAction.callbackData },
      ],
      [
        { text: "👥 Kill All User Sessions", callback_data: revokeAllAction.callbackData },
        { text: "⛔ Suspend User", callback_data: suspendAction.callbackData },
      ],
      [
        { text: "✅ Dismiss Alert", callback_data: dismissAction.callbackData },
      ],
    ];
  }

  private async sendMessage(params: Record<string, any>): Promise<TelegramMessageResponse | null> {
    return this.callApi("sendMessage", params);
  }

  private async editMessageText(params: Record<string, any>): Promise<TelegramMessageResponse | null> {
    return this.callApi("editMessageText", params);
  }

  private async editMessageReplyMarkup(params: Record<string, any>): Promise<TelegramMessageResponse | null> {
    return this.callApi("editMessageReplyMarkup", params);
  }

  private async callApi(endpoint: string, body: Record<string, any>): Promise<any> {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/${endpoint}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch (err) {
      console.error(`[SessionGuard:Telegram] API call to ${endpoint} failed:`, err);
      return null;
    }
  }
}
