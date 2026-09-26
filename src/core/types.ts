/**
 * Device and Browser classification metadata
 */
export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export interface ParsedClientInfo {
  deviceType: DeviceType;
  browser: string;
  os: string;
  ipAddress?: string;
  city?: string;
  country?: string;
  rawUserAgent?: string;
}

/**
 * Public DTO representing an active session shown in UI
 */
export interface ActiveSessionDTO {
  id: string;
  isCurrent: boolean;
  deviceType: DeviceType;
  browser: string;
  os: string;
  ipAddress: string | null;
  city?: string | null;
  country?: string | null;
  createdAt: string | Date;
  lastActiveAt: string | Date;
  expires: string | Date;
}

/**
 * Cache adapter interface for Edge-compatible token blacklisting.
 * Implement this to plug in Redis, Upstash, or in-memory caches.
 */
export interface CacheAdapter {
  /** Check if a token is blacklisted (revoked). Returns true if blacklisted. */
  isBlacklisted(token: string): Promise<boolean>;
  /** Blacklist a token. Optional TTL in seconds. */
  blacklist(token: string, ttlSeconds?: number): Promise<void>;
  /** Remove a token from the blacklist. */
  removeFromBlacklist(token: string): Promise<void>;
}

/**
 * Context provided to the `onNewDeviceDetected` callback
 */
export interface NewDeviceContext {
  userId: string;
  sessionId?: string;
  sessionToken?: string;
  newSession: {
    id?: string;
    browser: string;
    os: string;
    deviceType: string;
    ipAddress?: string;
    city?: string;
    country?: string;
    createdAt?: Date | string;
    lastActiveAt?: Date | string;
    latitude?: number;
    longitude?: number;
  };
  isNewBrowser: boolean;
  isNewOS: boolean;
  isNewLocation: boolean;
  isNewIP: boolean;
  existingSessions: Array<{
    id?: string;
    browser: string;
    os: string;
    ipAddress?: string;
    city?: string;
    country?: string;
    createdAt?: Date | string;
    lastActiveAt?: Date | string;
    latitude?: number;
    longitude?: number;
  }>;
}

/**
 * Configuration options for SessionManager
 */
export interface SessionManagerConfig {
  /**
   * Maximum allowed concurrent active sessions per user.
   * If exceeded, the oldest active session is automatically revoked.
   * Default: unlimited (0 or undefined)
   */
  maxConcurrentSessions?: number;

  /**
   * Session validity duration in days.
   * Default: 30 days
   */
  sessionDurationDays?: number;

  /**
   * Throttle duration in seconds for updating `lastActiveAt`.
   * Prevents hammering the database on every single request.
   * Default: 300 seconds (5 minutes)
   */
  activityThrottleSeconds?: number;

  /**
   * Optional cache adapter for Edge-compatible token blacklisting.
   * When provided, revoked tokens are cached for sub-millisecond checks
   * in the middleware before hitting the database.
   */
  cacheAdapter?: CacheAdapter;

  /**
   * Optional geo-location provider for self-hosted deployments.
   * Called when hosting-provider headers (Vercel, Cloudflare, etc.) are unavailable.
   * Can integrate with geoip-lite, ipapi, ip-api.com, or any geo service.
   *
   * @example
   * geoProvider: async (ip) => {
   *   const geo = geoip.lookup(ip);
   *   return geo ? { city: geo.city, country: geo.country } : null;
   * }
   */
  geoProvider?: (ip: string) => Promise<{ city?: string; country?: string } | null>;

  /**
   * Callback fired when a login is detected from a new/unknown device.
   * Useful for sending security alert emails to the user.
   * This is called asynchronously (fire-and-forget) so it won't block login.
   *
   * @example
   * onNewDeviceDetected: async ({ userId, newSession, isNewLocation }) => {
   *   await sendEmail(userId, `New login from ${newSession.browser} on ${newSession.os}`);
   * }
   */
  onNewDeviceDetected?: (context: NewDeviceContext) => Promise<void> | void;

  /**
   * Enable automatic token rotation on every validation.
   * When enabled, the session token is regenerated periodically
   * and the old token is blacklisted, preventing stolen tokens from being reused.
   *
   * Set to a number (seconds) for rotation interval, or `false` to disable.
   * Default: false (disabled)
   *
   * @example
   * tokenRotationIntervalSeconds: 86400 // Rotate token every 24 hours
   */
  tokenRotationIntervalSeconds?: number | false;

  /**
   * Enable session hijacking protection via fingerprint binding.
   * When enabled, the middleware verifies that the request IP matches the
   * session's stored IP. If a mismatch is detected, the session is auto-revoked.
   *
   * Options:
   * - `"strict"`: IP must match exactly (recommended for banking/finance apps)
   * - `"relaxed"`: Only country must match (good for mobile users who switch IPs)
   * - `false`: Disabled
   *
   * Default: false
   */
  hijackingProtection?: "strict" | "relaxed" | false;

  /**
   * Callback fired when a session is revoked (from any source: API, Telegram, middleware).
   * Useful for SSE/WebSocket real-time browser kick notifications.
   */
  onSessionRevoked?: (event: SessionRevokedEvent) => Promise<void> | void;
}

/**
 * Cleanup / Garbage Collection schedule presets
 */
export type CleanupSchedule = "monthly" | "semi-annual" | "annual" | "manual";

/**
 * Options for cleaning up expired/revoked sessions
 */
export interface CleanupOptions {
  /**
   * Preset schedule or custom retention in days.
   * - "monthly": Delete sessions older than 30 days
   * - "semi-annual": Delete sessions older than 180 days
   * - "annual": Delete sessions older than 365 days
   * - "manual": Must provide `retentionDays` explicitly
   */
  schedule?: CleanupSchedule;

  /**
   * Custom retention period in days. Overrides `schedule` preset.
   * Sessions that expired or were revoked more than this many days ago will be deleted.
   */
  retentionDays?: number;

  /**
   * If true, only delete revoked sessions (keep expired but unrevoked sessions).
   * Default: false (delete both expired and revoked)
   */
  revokedOnly?: boolean;

  /**
   * Maximum number of records to delete in a single batch.
   * Useful for avoiding long-running database transactions.
   * Default: 10000
   */
  batchSize?: number;
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  deletedCount: number;
  schedule: CleanupSchedule | "custom";
  retentionDays: number;
  executedAt: Date;
}

/**
 * Event emitted when a session is revoked
 */
export interface SessionRevokedEvent {
  sessionId: string;
  userId: string;
  sessionToken?: string;
  reason: "admin_revoke" | "user_revoke" | "hijack_detected" | "token_rotated" | "concurrent_limit" | "all_revoked";
  revokedBy?: string;
  timestamp: Date;
}

/**
 * Token rotation result
 */
export interface TokenRotationResult {
  oldToken: string;
  newToken: string;
  rotatedAt: Date;
}

/**
 * Minimal Prisma Client interface required by SessionManager
 */
export interface MinimalPrismaClient {
  session: {
    findUnique: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
    deleteMany: (args: any) => Promise<any>;
  };
}

export interface CreateSessionOptions {
  userId: string;
  sessionToken?: string;
  req?: Request | Headers;
  ipAddress?: string;
  userAgent?: string;
  expiresAt?: Date;
}

export interface RevokeSessionOptions {
  sessionId: string;
  userId: string;
}

export interface RevokeOtherSessionsOptions {
  currentSessionId?: string;
  currentSessionToken?: string;
  userId: string;
}
