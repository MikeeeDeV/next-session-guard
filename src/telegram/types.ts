import { NewDeviceContext } from "../core/types";
import { SessionManager } from "../core/session-manager";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AdminActionType =
  | "revoke_session"
  | "revoke_all"
  | "ghost_session"
  | "suspend_user"
  | "dismiss";

export interface TelegramAdminInfo {
  id: number;
  username?: string;
  firstName: string;
  lastName?: string;
}

export interface KineticTravelResult {
  distanceKm: number;
  timeDeltaMinutes: number;
  speedKmh: number;
  isImpossible: boolean;
  previousLocation?: string;
  currentLocation?: string;
  description: string;
}

export interface RiskAnalysis {
  score: number;
  level: RiskLevel;
  reasons: string[];
  kinetic?: KineticTravelResult;
}

export interface AdminPendingAction {
  id: string;
  type: AdminActionType;
  sessionId?: string;
  sessionToken?: string;
  userId: string;
  chatId: string | number;
  messageId?: number;
  expiresAt: number;
  used: boolean;
  requiredQuorum: number;
  approvedBy: Array<{ id: number; username?: string; name: string }>;
  metadata?: Record<string, any>;
}

export interface TelegramAdminGuardConfig {
  /**
   * Telegram Bot API Token from @BotFather
   */
  botToken: string;

  /**
   * Telegram Admin Supergroup or Channel Chat ID (must start with -100...)
   * The bot will strictly reject any messages or actions outside this chat.
   */
  adminGroupId: string | number;

  /**
   * Optional Forum Topic (Thread) ID within the Supergroup.
   * Directs alerts to a dedicated topic (e.g. #security-alerts).
   */
  threadId?: number;

  /**
   * Secret token to verify Telegram Webhook calls (X-Telegram-Bot-Api-Secret-Token).
   * Highly recommended in production.
   */
  secretToken?: string;

  /**
   * Secret key used to sign compact action tokens with HMAC-SHA256.
   * If omitted, a secure process-level secret is generated automatically.
   */
  actionSecret?: string;

  /**
   * Minimum risk score (0-100) required to dispatch an alert.
   * Default: 0 (alerts on all new device events)
   */
  minRiskScore?: number;

  /**
   * Whitelist of Telegram User IDs allowed to click interactive admin buttons.
   * If undefined or empty, any admin in the adminGroupId can interact.
   */
  allowedAdminUserIds?: Array<string | number>;

  /**
   * Enable kinetic impossible travel speed calculations (Haversine formula).
   * Default: true
   */
  enableKineticTravel?: boolean;

  /**
   * Enable burst attack incident aggregation to prevent Telegram rate limit bans.
   * Default: true
   */
  enableIncidentDamper?: boolean;

  /**
   * Number of incidents in window to trigger collapse mode.
   * Default: 4
   */
  burstThreshold?: number;

  /**
   * Time window in seconds for burst detection.
   * Default: 20
   */
  burstWindowSeconds?: number;

  /**
   * Time-to-live for interactive action buttons in seconds before self-neutralization.
   * Default: 900 (15 minutes)
   */
  actionTtlSeconds?: number;

  /**
   * Actions requiring dual-admin quorum approval before execution.
   * Default: ["revoke_all", "suspend_user"]
   */
  dualAdminQuorumActions?: AdminActionType[];

  /**
   * Optional callback when an admin executes "Suspend User" from Telegram.
   */
  onSuspendUser?: (userId: string, admin: TelegramAdminInfo) => Promise<void> | void;

  /**
   * Optional callback when an admin tags a session for "Ghost / Honeypot Mode".
   */
  onGhostSession?: (sessionId: string, userId: string, admin: TelegramAdminInfo) => Promise<void> | void;
}

export interface TelegramWebhookHandlerConfig extends TelegramAdminGuardConfig {
  sessionManager: SessionManager;
}
