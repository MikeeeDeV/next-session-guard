import * as crypto from "crypto";
import { AdminActionType, AdminPendingAction, TelegramAdminInfo } from "./types";

/**
 * Compact Ephemeral Action Vault
 *
 * Solves Telegram's strict 64-byte callback_data limit while enforcing:
 * 1. Cryptographic HMAC-SHA256 integrity (anti-tampering)
 * 2. Strict time-to-live (TTL, default 15 mins) anti-replay protection
 * 3. Dual-Admin Quorum tracking for destructive operations
 * 4. Self-cleaning memory storage
 */
export class ActionVault {
  private actions = new Map<string, AdminPendingAction>();
  private secret: string;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(secret?: string) {
    this.secret = secret || crypto.randomBytes(32).toString("hex");
    // Periodic sweep every 5 minutes
    if (typeof setInterval !== "undefined") {
      this.cleanupTimer = setInterval(() => this.purgeExpired(), 5 * 60 * 1000);
      if (this.cleanupTimer.unref) this.cleanupTimer.unref();
    }
  }

  /**
   * Generates a compact callback_data token safe for Telegram's 64-byte limit.
   * Format: `a:<shortId>:<sig>` (approx 16 bytes)
   */
  createAction(params: {
    type: AdminActionType;
    sessionId?: string;
    sessionToken?: string;
    userId: string;
    chatId: string | number;
    messageId?: number;
    ttlSeconds?: number;
    requiredQuorum?: number;
    metadata?: Record<string, any>;
  }): { actionId: string; callbackData: string } {
    const shortId = crypto.randomBytes(4).toString("hex");
    const sig = this.computeSig(shortId);
    const ttlSeconds = params.ttlSeconds ?? 900; // 15 minutes default

    const pendingAction: AdminPendingAction = {
      id: shortId,
      type: params.type,
      sessionId: params.sessionId,
      sessionToken: params.sessionToken,
      userId: params.userId,
      chatId: params.chatId,
      messageId: params.messageId,
      expiresAt: Date.now() + ttlSeconds * 1000,
      used: false,
      requiredQuorum: params.requiredQuorum ?? 1,
      approvedBy: [],
      metadata: params.metadata,
    };

    this.actions.set(shortId, pendingAction);

    // Telegram callback_data format: "a:<shortId>:<sig>"
    return {
      actionId: shortId,
      callbackData: `a:${shortId}:${sig}`,
    };
  }

  /**
   * Verifies callback_data format and HMAC signature, then retrieves action
   */
  verifyAndGet(callbackData: string): {
    valid: boolean;
    action: AdminPendingAction | null;
    reason?: string;
  } {
    if (!callbackData.startsWith("a:")) {
      return { valid: false, action: null, reason: "invalid_prefix" };
    }

    const parts = callbackData.split(":");
    if (parts.length < 3) {
      return { valid: false, action: null, reason: "malformed_callback_data" };
    }

    const [, shortId, sig] = parts;
    const expectedSig = this.computeSig(shortId);

    // Constant-time comparison
    if (!this.timingSafeCompare(sig, expectedSig)) {
      return { valid: false, action: null, reason: "invalid_hmac_signature" };
    }

    const action = this.actions.get(shortId);
    if (!action) {
      return { valid: false, action: null, reason: "action_not_found_or_expired" };
    }

    if (Date.now() > action.expiresAt) {
      this.actions.delete(shortId);
      return { valid: false, action: null, reason: "action_expired" };
    }

    if (action.used) {
      return { valid: false, action: null, reason: "action_already_used" };
    }

    return { valid: true, action };
  }

  /**
   * Records an admin vote for quorum approval.
   * Returns whether quorum has been reached.
   */
  registerApproval(
    action: AdminPendingAction,
    admin: TelegramAdminInfo
  ): {
    quorumReached: boolean;
    alreadyApproved: boolean;
    currentCount: number;
    required: number;
  } {
    const alreadyApproved = action.approvedBy.some((a) => a.id === admin.id);
    if (!alreadyApproved) {
      action.approvedBy.push({
        id: admin.id,
        username: admin.username,
        name: [admin.firstName, admin.lastName].filter(Boolean).join(" "),
      });
    }

    const quorumReached = action.approvedBy.length >= action.requiredQuorum;
    if (quorumReached) {
      action.used = true;
    }

    return {
      quorumReached,
      alreadyApproved,
      currentCount: action.approvedBy.length,
      required: action.requiredQuorum,
    };
  }

  /**
   * Explicitly marks action as used / consumed
   */
  consume(shortId: string): void {
    const action = this.actions.get(shortId);
    if (action) {
      action.used = true;
      this.actions.delete(shortId);
    }
  }

  /**
   * Updates the messageId associated with an action (once sent by Telegram)
   */
  attachMessageId(shortId: string, messageId: number): void {
    const action = this.actions.get(shortId);
    if (action) {
      action.messageId = messageId;
    }
  }

  private computeSig(shortId: string): string {
    return crypto
      .createHmac("sha256", this.secret)
      .update(shortId)
      .digest("hex")
      .slice(0, 8); // 8-char hex is plenty for compact 15-min ephemeral tokens
  }

  private timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return crypto.timingSafeEqual(bufA, bufB);
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [id, action] of this.actions.entries()) {
      if (now > action.expiresAt || action.used) {
        this.actions.delete(id);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.actions.clear();
  }
}
