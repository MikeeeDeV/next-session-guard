export interface GhostTelemetryEntry {
  timestamp: number;
  path: string;
  method: string;
  ip?: string;
  userAgent?: string;
}

export interface GhostSessionRecord {
  sessionId: string;
  userId: string;
  taggedAt: number;
  taggedByAdmin?: string;
  telemetry: GhostTelemetryEntry[];
}

const ghostSessions = new Map<string, GhostSessionRecord>();

/**
 * Marks a session as a Ghost / Honeypot session.
 * Used when an admin wants to observe an attacker without immediately alerting them.
 */
export function markSessionAsGhost(
  sessionId: string,
  userId: string,
  taggedByAdmin?: string
): void {
  ghostSessions.set(sessionId, {
    sessionId,
    userId,
    taggedAt: Date.now(),
    taggedByAdmin,
    telemetry: [],
  });
}

/**
 * Checks if a session is currently running under Ghost / Honeypot mode.
 */
export function isGhostSession(sessionId: string): boolean {
  return ghostSessions.has(sessionId);
}

/**
 * Records an attacker probe or action on a Ghost session for live forensics.
 */
export function recordGhostTelemetry(
  sessionId: string,
  entry: Omit<GhostTelemetryEntry, "timestamp">
): void {
  const session = ghostSessions.get(sessionId);
  if (session) {
    session.telemetry.push({
      ...entry,
      timestamp: Date.now(),
    });
    // Keep last 100 entries max to prevent memory bloat
    if (session.telemetry.length > 100) {
      session.telemetry.shift();
    }
  }
}

/**
 * Retrieves forensics telemetry collected for a Ghost session.
 */
export function getGhostSessionRecord(sessionId: string): GhostSessionRecord | undefined {
  return ghostSessions.get(sessionId);
}

/**
 * Removes Ghost status from a session
 */
export function removeGhostStatus(sessionId: string): void {
  ghostSessions.delete(sessionId);
}
