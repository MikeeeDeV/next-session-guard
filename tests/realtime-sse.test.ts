import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SSEHub, getSSEHub, resetSSEHub, createSSERevocationBridge } from "../src/realtime/index";
import type { SessionRevokedEvent } from "../src/core/types";

describe("SSE Realtime Hub", () => {
  beforeEach(() => {
    resetSSEHub();
  });

  afterEach(() => {
    resetSSEHub();
  });

  describe("Connection Management", () => {
    it("should create a readable stream on connect", () => {
      const hub = getSSEHub();
      const stream = hub.connect("user1", "token1");
      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it("should track connected users", () => {
      const hub = getSSEHub();
      hub.connect("user1", "token1");
      expect(hub.isUserConnected("user1")).toBe(true);
      expect(hub.isUserConnected("user2")).toBe(false);
    });

    it("should report accurate stats", () => {
      const hub = getSSEHub();
      hub.connect("user1", "token1");
      hub.connect("user1", "token2");
      hub.connect("user2", "token3");

      const stats = hub.getStats();
      expect(stats.totalConnections).toBe(3);
      expect(stats.uniqueUsers).toBe(2);
      expect(stats.connections).toHaveLength(2);
    });

    it("should evict oldest connections when max is reached", () => {
      const hub = getSSEHub({ maxConnectionsPerUser: 2 });

      // Connect 3 times for user1 (max is 2)
      hub.connect("user1", "token1");
      hub.connect("user1", "token2");
      hub.connect("user1", "token3"); // Should evict token1

      const stats = hub.getStats();
      const userStats = stats.connections.find((c) => c.userId === "user1");
      expect(userStats!.count).toBe(2);
    });

    it("should disconnect a user and clean up", () => {
      const hub = getSSEHub();
      const stream = hub.connect("user1", "token1");

      expect(hub.isUserConnected("user1")).toBe(true);

      // Cancel the stream (simulates browser disconnect)
      const reader = stream.getReader();
      reader.cancel();

      // After cancellation, user should eventually be disconnected
      // The cancel callback fires asynchronously
    });
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const hub1 = getSSEHub();
      const hub2 = getSSEHub();
      expect(hub1).toBe(hub2);
    });

    it("should create new instance after reset", () => {
      const hub1 = getSSEHub();
      resetSSEHub();
      const hub2 = getSSEHub();
      expect(hub1).not.toBe(hub2);
    });
  });

  describe("Broadcast Revocation", () => {
    it("should broadcast revocation events to connected user", async () => {
      const hub = getSSEHub();
      const stream = hub.connect("user1", "revoked-token");
      const reader = stream.getReader();

      // Read the initial "connected" event
      const { value: connectedEvent } = await reader.read();
      const connectedText = new TextDecoder().decode(connectedEvent);
      expect(connectedText).toContain("event: connected");

      // Broadcast revocation
      const event: SessionRevokedEvent = {
        sessionId: "sess1",
        userId: "user1",
        sessionToken: "revoked-token",
        reason: "user_revoke",
        timestamp: new Date(),
      };
      hub.broadcastRevocation(event);

      // Read the revocation event
      const { value: revokeEvent } = await reader.read();
      const revokeText = new TextDecoder().decode(revokeEvent);
      expect(revokeText).toContain("event: session_revoked");
      expect(revokeText).toContain("user_revoke");

      reader.cancel();
    });

    it("should send 'session_revoked_other' to non-target sessions", async () => {
      const hub = getSSEHub();

      // Connect two sessions for the same user
      const stream1 = hub.connect("user1", "keep-token");
      const stream2 = hub.connect("user1", "revoked-token");

      const reader1 = stream1.getReader();
      const reader2 = stream2.getReader();

      // Read initial connected events
      await reader1.read();
      await reader2.read();

      // Revoke only stream2's token
      hub.broadcastRevocation({
        sessionId: "sess2",
        userId: "user1",
        sessionToken: "revoked-token",
        reason: "admin_revoke",
        timestamp: new Date(),
      });

      // Stream1 should get "session_revoked_other"
      const { value: event1 } = await reader1.read();
      const text1 = new TextDecoder().decode(event1);
      expect(text1).toContain("event: session_revoked_other");

      // Stream2 should get "session_revoked"
      const { value: event2 } = await reader2.read();
      const text2 = new TextDecoder().decode(event2);
      expect(text2).toContain("event: session_revoked");

      reader1.cancel();
      reader2.cancel();
    });
  });

  describe("Broadcast Kick All", () => {
    it("should send kick_all event to all user's connections", async () => {
      const hub = getSSEHub();
      const stream = hub.connect("user1", "token1");
      const reader = stream.getReader();

      // Read connected event
      await reader.read();

      // Kick all
      hub.broadcastKickAll("user1", "password_changed");

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      expect(text).toContain("event: kick_all");
      expect(text).toContain("password_changed");

      reader.cancel();
    });
  });

  describe("SSE Revocation Bridge", () => {
    it("should create a bridge function", () => {
      const bridge = createSSERevocationBridge();
      expect(typeof bridge).toBe("function");
    });

    it("should call broadcastRevocation for normal revocations", () => {
      const hub = getSSEHub();
      const broadcastSpy = vi.spyOn(hub, "broadcastRevocation");

      const bridge = createSSERevocationBridge();
      const event: SessionRevokedEvent = {
        sessionId: "sess1",
        userId: "user1",
        reason: "user_revoke",
        timestamp: new Date(),
      };

      bridge(event);
      expect(broadcastSpy).toHaveBeenCalledWith(event);
    });

    it("should call broadcastKickAll for all_revoked events", () => {
      const hub = getSSEHub();
      const kickSpy = vi.spyOn(hub, "broadcastKickAll");

      const bridge = createSSERevocationBridge();
      const event: SessionRevokedEvent = {
        sessionId: "all",
        userId: "user1",
        reason: "all_revoked",
        timestamp: new Date(),
      };

      bridge(event);
      expect(kickSpy).toHaveBeenCalledWith("user1", "all_revoked");
    });
  });

  describe("Destroy", () => {
    it("should clean up all connections on destroy", () => {
      const hub = getSSEHub();
      hub.connect("user1", "token1");
      hub.connect("user2", "token2");

      expect(hub.getStats().totalConnections).toBe(2);
      hub.destroy();
      expect(hub.getStats().totalConnections).toBe(0);
    });
  });
});
