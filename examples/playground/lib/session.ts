import {
  SessionManager,
  createMemoryAdapter,
} from "next-session-guard";
import { getSSEHub, createSSERevocationBridge } from "next-session-guard/realtime";

// Universal in-memory session adapter for instant playground evaluation
export const memoryAdapter = createMemoryAdapter();

// Initialize the SSE Hub & Revocation Bridge
export const sseHub = getSSEHub();
export const sseBridge = createSSERevocationBridge(sseHub);

// Initialize SessionManager with full security features enabled
export const sessionManager = new SessionManager(memoryAdapter, {
  maxConcurrentSessions: 5,
  sessionDurationDays: 30,
  activityThrottleSeconds: 60,
  hijackingProtection: "strict",
  tokenRotationIntervalSeconds: 86400, // 24 hours
  onSessionRevoked: (event) => {
    // Broadcast revocation to any open browser tab in real time!
    sseBridge(event);
  },
});

// Seed sample sessions for demonstration
let seeded = false;
export async function ensureSampleSessions() {
  if (seeded) return;
  seeded = true;

  // Current session (Cairo)
  await memoryAdapter.createSession({
    userId: "demo_user_1",
    sessionToken: "demo_current_token_123",
    browser: "Chrome 128.0",
    os: "macOS 15.0",
    deviceType: "desktop",
    ipAddress: "156.204.18.92",
    city: "Cairo",
    country: "EG",
    expires: new Date(Date.now() + 86400000 * 30),
    lastActiveAt: new Date(),
    isRevoked: false,
  });

  // Mobile session (Alexandria)
  await memoryAdapter.createSession({
    userId: "demo_user_1",
    sessionToken: "demo_mobile_token_456",
    browser: "Mobile Safari 17.5",
    os: "iOS 18.0",
    deviceType: "mobile",
    ipAddress: "156.204.18.92",
    city: "Alexandria",
    country: "EG",
    expires: new Date(Date.now() + 86400000 * 25),
    lastActiveAt: new Date(Date.now() - 3600000 * 3),
    isRevoked: false,
  });

  // Suspicious foreign session (Tokyo)
  await memoryAdapter.createSession({
    userId: "demo_user_1",
    sessionToken: "demo_foreign_token_789",
    browser: "Firefox 130.0",
    os: "Windows 11",
    deviceType: "desktop",
    ipAddress: "133.242.18.5",
    city: "Tokyo",
    country: "JP",
    expires: new Date(Date.now() + 86400000 * 30),
    lastActiveAt: new Date(Date.now() - 1000 * 60 * 15),
    isRevoked: false,
  });
}
