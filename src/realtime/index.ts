/**
 * next-session-guard/realtime
 *
 * Server-Sent Events (SSE) engine for real-time browser session revocation.
 * When a session is revoked from any source (admin panel, Telegram, API),
 * connected browsers receive an instant "kick" event.
 *
 * Import from "next-session-guard/realtime"
 */

import type { SessionRevokedEvent } from "../core/types";

// ── Types ───────────────────────────────────────────────────────────────

export interface SSEClient {
  id: string;
  userId: string;
  sessionToken: string;
  controller: ReadableStreamDefaultController;
  connectedAt: Date;
}

export interface SSEBroadcastOptions {
  /** Max connections per user. Default: 10 */
  maxConnectionsPerUser?: number;
  /** Heartbeat interval in milliseconds. Default: 30000 (30s) */
  heartbeatIntervalMs?: number;
  /** Enable debug logging. Default: false */
  debug?: boolean;
}

// ── SSE Hub (Singleton) ─────────────────────────────────────────────────

class SSEHub {
  private clients: Map<string, SSEClient[]> = new Map(); // userId -> SSEClient[]
  private heartbeatTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private maxConnectionsPerUser: number;
  private heartbeatIntervalMs: number;
  private debug: boolean;

  constructor(options?: SSEBroadcastOptions) {
    this.maxConnectionsPerUser = options?.maxConnectionsPerUser ?? 10;
    this.heartbeatIntervalMs = options?.heartbeatIntervalMs ?? 30_000;
    this.debug = options?.debug ?? false;
  }

  /**
   * Register a new SSE client connection.
   * Returns a ReadableStream to pipe to the response.
   */
  connect(userId: string, sessionToken: string): ReadableStream {
    const clientId = `${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

    const stream = new ReadableStream({
      start: (controller) => {
        const client: SSEClient = {
          id: clientId,
          userId,
          sessionToken,
          controller,
          connectedAt: new Date(),
        };

        // Get or create client list for this user
        const userClients = this.clients.get(userId) || [];

        // Enforce max connections per user (evict oldest)
        while (userClients.length >= this.maxConnectionsPerUser) {
          const oldest = userClients.shift();
          if (oldest) {
            this.closeClient(oldest, "evicted");
          }
        }

        userClients.push(client);
        this.clients.set(userId, userClients);

        // Start heartbeat if not already running for this user
        if (!this.heartbeatTimers.has(userId)) {
          const timer = setInterval(() => {
            this.sendHeartbeat(userId);
          }, this.heartbeatIntervalMs);
          if (timer?.unref) timer.unref();
          this.heartbeatTimers.set(userId, timer);
        }

        // Send initial connection event
        this.sendToClient(client, {
          type: "connected",
          data: { clientId, timestamp: new Date().toISOString() },
        });

        if (this.debug) {
          console.log(`[SessionGuard SSE] Client connected: ${clientId} (user: ${userId})`);
        }
      },
      cancel: () => {
        this.disconnect(clientId, userId);
      },
    });

    return stream;
  }

  /**
   * Disconnect a specific client
   */
  disconnect(clientId: string, userId: string): void {
    const userClients = this.clients.get(userId);
    if (!userClients) return;

    const index = userClients.findIndex((c) => c.id === clientId);
    if (index !== -1) {
      userClients.splice(index, 1);
      if (this.debug) {
        console.log(`[SessionGuard SSE] Client disconnected: ${clientId}`);
      }
    }

    if (userClients.length === 0) {
      this.clients.delete(userId);
      const timer = this.heartbeatTimers.get(userId);
      if (timer) {
        clearInterval(timer);
        this.heartbeatTimers.delete(userId);
      }
    }
  }

  /**
   * Broadcast a session revocation event to all connected clients of a user.
   * The client whose token was revoked gets a "session_revoked" event.
   * Other clients of the same user get a "session_revoked_other" event.
   */
  broadcastRevocation(event: SessionRevokedEvent): void {
    const userClients = this.clients.get(event.userId);
    if (!userClients || userClients.length === 0) return;

    for (const client of [...userClients]) {
      const isTargetSession =
        event.sessionToken && client.sessionToken === event.sessionToken;

      const eventType = isTargetSession ? "session_revoked" : "session_revoked_other";

      this.sendToClient(client, {
        type: eventType,
        data: {
          sessionId: event.sessionId,
          reason: event.reason,
          timestamp: event.timestamp.toISOString(),
          revokedBy: event.revokedBy,
        },
      });

      // Close the revoked client's connection after sending the event
      if (isTargetSession) {
        setTimeout(() => {
          this.closeClient(client, "revoked");
          this.disconnect(client.id, event.userId);
        }, 100);
      }
    }
  }

  /**
   * Broadcast a "kick_all" event when all sessions are revoked
   */
  broadcastKickAll(userId: string, reason?: string): void {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.length === 0) return;

    for (const client of [...userClients]) {
      this.sendToClient(client, {
        type: "kick_all",
        data: {
          reason: reason || "all_revoked",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Close all connections after a short delay
    setTimeout(() => {
      const clients = this.clients.get(userId);
      if (clients) {
        for (const client of clients) {
          this.closeClient(client, "kick_all");
        }
        this.clients.delete(userId);
        const timer = this.heartbeatTimers.get(userId);
        if (timer) {
          clearInterval(timer);
          this.heartbeatTimers.delete(userId);
        }
      }
    }, 200);
  }

  /**
   * Get connection stats
   */
  getStats(): {
    totalConnections: number;
    uniqueUsers: number;
    connections: Array<{ userId: string; count: number; oldestConnection: Date }>;
  } {
    let totalConnections = 0;
    const connections: Array<{ userId: string; count: number; oldestConnection: Date }> = [];

    for (const [userId, clients] of this.clients) {
      totalConnections += clients.length;
      const oldest = clients.reduce(
        (min, c) => (c.connectedAt < min ? c.connectedAt : min),
        clients[0]?.connectedAt || new Date()
      );
      connections.push({ userId, count: clients.length, oldestConnection: oldest });
    }

    return {
      totalConnections,
      uniqueUsers: this.clients.size,
      connections,
    };
  }

  /**
   * Check if a user has active SSE connections
   */
  isUserConnected(userId: string): boolean {
    const clients = this.clients.get(userId);
    return !!clients && clients.length > 0;
  }

  /**
   * Destroy the hub and clean up all connections
   */
  destroy(): void {
    for (const [userId, clients] of this.clients) {
      for (const client of clients) {
        this.closeClient(client, "shutdown");
      }
      const timer = this.heartbeatTimers.get(userId);
      if (timer) clearInterval(timer);
    }
    this.clients.clear();
    this.heartbeatTimers.clear();
  }

  // ── Private Methods ──────────────────────────────────────────────────

  private sendToClient(
    client: SSEClient,
    payload: { type: string; data: Record<string, any> }
  ): void {
    try {
      const message = `event: ${payload.type}\ndata: ${JSON.stringify(payload.data)}\n\n`;
      client.controller.enqueue(new TextEncoder().encode(message));
    } catch {
      // Client disconnected, will be cleaned up
      this.disconnect(client.id, client.userId);
    }
  }

  private sendHeartbeat(userId: string): void {
    const userClients = this.clients.get(userId);
    if (!userClients) return;

    for (const client of [...userClients]) {
      try {
        const message = `: heartbeat ${Date.now()}\n\n`;
        client.controller.enqueue(new TextEncoder().encode(message));
      } catch {
        this.disconnect(client.id, userId);
      }
    }
  }

  private closeClient(client: SSEClient, reason: string): void {
    try {
      if (this.debug) {
        console.log(`[SessionGuard SSE] Closing client ${client.id}: ${reason}`);
      }
      client.controller.close();
    } catch {
      // Already closed
    }
  }
}

// ── Singleton Instance ──────────────────────────────────────────────────

let _instance: SSEHub | null = null;

/**
 * Get or create the global SSE Hub instance.
 * This is a singleton — call it from anywhere in your app to get the same hub.
 *
 * @example
 * ```ts
 * import { getSSEHub } from "next-session-guard/realtime";
 *
 * // In your SessionManager config:
 * const hub = getSSEHub();
 * const sessionManager = new SessionManager(prisma, {
 *   onSessionRevoked: (event) => hub.broadcastRevocation(event),
 * });
 *
 * // In your SSE API route:
 * export async function GET(req: Request) {
 *   const hub = getSSEHub();
 *   const stream = hub.connect(userId, sessionToken);
 *   return new Response(stream, {
 *     headers: {
 *       "Content-Type": "text/event-stream",
 *       "Cache-Control": "no-cache",
 *       "Connection": "keep-alive",
 *     },
 *   });
 * }
 * ```
 */
export function getSSEHub(options?: SSEBroadcastOptions): SSEHub {
  if (!_instance) {
    _instance = new SSEHub(options);
  }
  return _instance;
}

/**
 * Reset the global SSE Hub (useful for testing)
 */
export function resetSSEHub(): void {
  if (_instance) {
    _instance.destroy();
    _instance = null;
  }
}

/**
 * Creates the `onSessionRevoked` callback that bridges SessionManager → SSE Hub.
 * Use this as a convenience to wire everything together.
 *
 * @example
 * ```ts
 * import { createSSERevocationBridge } from "next-session-guard/realtime";
 *
 * const sessionManager = new SessionManager(prisma, {
 *   onSessionRevoked: createSSERevocationBridge(),
 * });
 * ```
 */
export function createSSERevocationBridge(
  hubOptions?: SSEBroadcastOptions
): (event: SessionRevokedEvent) => void {
  return (event: SessionRevokedEvent) => {
    const hub = getSSEHub(hubOptions);
    if (event.reason === "all_revoked") {
      hub.broadcastKickAll(event.userId, event.reason);
    } else {
      hub.broadcastRevocation(event);
    }
  };
}

export { SSEHub };
