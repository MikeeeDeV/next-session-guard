/**
 * Device and Browser classification metadata
 */
export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export interface ParsedClientInfo {
  deviceType: DeviceType;
  browser: string;
  os: string;
  ipAddress?: string;
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

