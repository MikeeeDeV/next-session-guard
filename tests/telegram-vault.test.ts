import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ActionVault } from "../src/telegram/action-vault";

describe("Telegram ActionVault (Compact Ephemeral Action Vault)", () => {
  let vault: ActionVault;

  beforeEach(() => {
    vault = new ActionVault("test_secret_12345");
  });

  afterEach(() => {
    vault.destroy();
  });

  it("generates callback_data strictly within Telegram's 64-byte limit", () => {
    const { actionId, callbackData } = vault.createAction({
      type: "revoke_session",
      sessionId: "session_cm1234567890abcdef",
      userId: "user_super_long_identifier_98765",
      chatId: -1001234567890,
    });

    expect(actionId).toBeDefined();
    expect(callbackData).toMatch(/^a:[0-9a-f]{8}:[0-9a-f]{8}$/);
    // Strict Telegram Limit is 64 bytes
    expect(Buffer.byteLength(callbackData, "utf-8")).toBeLessThan(25);
  });

  it("verifies and extracts valid action data", () => {
    const { callbackData } = vault.createAction({
      type: "revoke_session",
      sessionId: "sess_123",
      userId: "usr_456",
      chatId: -100999,
    });

    const res = vault.verifyAndGet(callbackData);
    expect(res.valid).toBe(true);
    expect(res.action?.sessionId).toBe("sess_123");
    expect(res.action?.userId).toBe("usr_456");
    expect(res.action?.type).toBe("revoke_session");
  });

  it("rejects tampered callback_data with HMAC failure", () => {
    const { callbackData } = vault.createAction({
      type: "revoke_session",
      sessionId: "sess_123",
      userId: "usr_456",
      chatId: -100999,
    });

    // Tamper with shortId
    const tampered = callbackData.replace(/^a:[0-9a-f]{4}/, "a:dead");
    const res = vault.verifyAndGet(tampered);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("invalid_hmac_signature");
  });

  it("rejects expired action tokens", async () => {
    const { callbackData } = vault.createAction({
      type: "revoke_session",
      sessionId: "sess_123",
      userId: "usr_456",
      chatId: -100999,
      ttlSeconds: 0, // Instant expiry
    });

    // Wait 10ms
    await new Promise((r) => setTimeout(r, 15));

    const res = vault.verifyAndGet(callbackData);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("action_expired");
  });

  it("enforces Single-Use token consumption (Anti-Replay Attack)", () => {
    const { actionId, callbackData } = vault.createAction({
      type: "revoke_session",
      sessionId: "sess_123",
      userId: "usr_456",
      chatId: -100999,
    });

    // First lookup
    const first = vault.verifyAndGet(callbackData);
    expect(first.valid).toBe(true);

    // Consume
    vault.consume(actionId);

    // Second lookup must fail
    const second = vault.verifyAndGet(callbackData);
    expect(second.valid).toBe(false);
    expect(second.reason).toBe("action_not_found_or_expired");
  });

  it("manages Dual-Admin Quorum voting properly", () => {
    const { callbackData } = vault.createAction({
      type: "suspend_user",
      userId: "usr_456",
      chatId: -100999,
      requiredQuorum: 2,
    });

    const { action } = vault.verifyAndGet(callbackData);
    expect(action).toBeDefined();

    const admin1 = { id: 101, username: "admin_one", firstName: "Alice" };
    const admin2 = { id: 102, username: "admin_two", firstName: "Bob" };

    // Admin 1 votes
    const vote1 = vault.registerApproval(action!, admin1);
    expect(vote1.quorumReached).toBe(false);
    expect(vote1.currentCount).toBe(1);

    // Admin 1 votes again (duplicate vote ignored)
    const vote1Dup = vault.registerApproval(action!, admin1);
    expect(vote1Dup.alreadyApproved).toBe(true);
    expect(vote1Dup.quorumReached).toBe(false);
    expect(vote1Dup.currentCount).toBe(1);

    // Admin 2 votes -> Quorum reached!
    const vote2 = vault.registerApproval(action!, admin2);
    expect(vote2.quorumReached).toBe(true);
    expect(vote2.currentCount).toBe(2);
  });
});
