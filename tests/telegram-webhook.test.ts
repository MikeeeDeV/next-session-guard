import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActionVault } from "../src/telegram/action-vault";
import { isGhostSession } from "../src/telegram/ghost-mode";
import { createTelegramAdminWebhookHandler } from "../src/telegram/webhook";

describe("Telegram Admin Webhook Handler (Strict SOC Lockdown & Actions)", () => {
  let mockPrisma: any;
  let mockSessionManager: any;
  let vault: ActionVault;
  const adminGroupId = -100987654321;
  const secretToken = "super_secret_webhook_token_xyz";

  beforeEach(() => {
    vault = new ActionVault("webhook_test_secret");

    mockSessionManager = {
      revokeSession: vi.fn().mockResolvedValue(true),
      revokeAllSessions: vi.fn().mockResolvedValue(3),
      prisma: {
        session: {
          findUnique: vi.fn().mockResolvedValue({ id: "sess_special_99", userId: "usr_99" }),
        },
      },
    };

    // Mock global fetch for Telegram Bot API
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ ok: true, result: { message_id: 101 } }),
      })
    );
  });

  it("rejects unauthorized webhook requests when secretToken does not match", async () => {
    const handler = createTelegramAdminWebhookHandler(
      {
        botToken: "fake_bot_token",
        adminGroupId,
        secretToken,
        sessionManager: mockSessionManager,
      },
      vault
    );

    const req = new Request("https://example.com/api/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": "wrong_token",
      },
      body: JSON.stringify({ update_id: 1 }),
    });

    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it("strictly enforces Admin Group Lockdown (rejects foreign chats)", async () => {
    const handler = createTelegramAdminWebhookHandler(
      {
        botToken: "fake_bot_token",
        adminGroupId,
        secretToken,
        sessionManager: mockSessionManager,
      },
      vault
    );

    const { callbackData } = vault.createAction({
      type: "revoke_session",
      sessionId: "sess_99",
      userId: "usr_1",
      chatId: adminGroupId,
    });

    const req = new Request("https://example.com/api/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": secretToken,
      },
      body: JSON.stringify({
        callback_query: {
          id: "cb_1",
          from: { id: 777, first_name: "Attacker" },
          message: { chat: { id: 123456789 }, message_id: 42 }, // WRONG CHAT!
          data: callbackData,
        },
      }),
    });

    const res = await handler(req);
    expect(res.status).toBe(200);

    // Verify session was NOT revoked
    expect(mockSessionManager.revokeSession).not.toHaveBeenCalled();

    // Verify rejection toast was sent
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("answerCallbackQuery"),
      expect.objectContaining({
        body: expect.stringContaining("Unauthorized chat"),
      })
    );
  });

  it("executes revoke_session when clicked by authorized admin in Admin Group", async () => {
    const handler = createTelegramAdminWebhookHandler(
      {
        botToken: "fake_bot_token",
        adminGroupId,
        secretToken,
        sessionManager: mockSessionManager,
      },
      vault
    );

    const { callbackData } = vault.createAction({
      type: "revoke_session",
      sessionId: "sess_victim_123",
      userId: "usr_alice",
      chatId: adminGroupId,
    });

    const req = new Request("https://example.com/api/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": secretToken,
      },
      body: JSON.stringify({
        callback_query: {
          id: "cb_valid_1",
          from: { id: 555, username: "soc_lead", first_name: "Sarah" },
          message: { chat: { id: adminGroupId }, message_id: 88 },
          data: callbackData,
        },
      }),
    });

    const res = await handler(req);
    expect(res.status).toBe(200);

    // Verify session was revoked in session manager!
    expect(mockSessionManager.revokeSession).toHaveBeenCalledWith({
      sessionId: "sess_victim_123",
      userId: "usr_alice",
    });

    // Verify answerCallbackQuery was called with success
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("answerCallbackQuery"),
      expect.objectContaining({
        body: expect.stringContaining("successfully revoked"),
      })
    );
  });

  it("engages Ghost / Honeypot Mode on session when selected", async () => {
    const onGhostSessionSpy = vi.fn();
    const handler = createTelegramAdminWebhookHandler(
      {
        botToken: "fake_bot_token",
        adminGroupId,
        secretToken,
        sessionManager: mockSessionManager,
        onGhostSession: onGhostSessionSpy,
      },
      vault
    );

    const { callbackData } = vault.createAction({
      type: "ghost_session",
      sessionId: "sess_honeypot_999",
      userId: "usr_hacker",
      chatId: adminGroupId,
    });

    const req = new Request("https://example.com/api/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": secretToken,
      },
      body: JSON.stringify({
        callback_query: {
          id: "cb_ghost_1",
          from: { id: 555, username: "soc_lead", first_name: "Sarah" },
          message: { chat: { id: adminGroupId }, message_id: 89 },
          data: callbackData,
        },
      }),
    });

    await handler(req);

    // Verify marked as ghost
    expect(isGhostSession("sess_honeypot_999")).toBe(true);
    expect(onGhostSessionSpy).toHaveBeenCalledWith(
      "sess_honeypot_999",
      "usr_hacker",
      expect.objectContaining({ username: "soc_lead" })
    );
  });

  it("enforces Dual-Admin Quorum for destructive actions (suspend_user)", async () => {
    const onSuspendSpy = vi.fn();
    const handler = createTelegramAdminWebhookHandler(
      {
        botToken: "fake_bot_token",
        adminGroupId,
        secretToken,
        sessionManager: mockSessionManager,
        dualAdminQuorumActions: ["suspend_user"],
        onSuspendUser: onSuspendSpy,
      },
      vault
    );

    const { callbackData } = vault.createAction({
      type: "suspend_user",
      userId: "usr_compromised",
      chatId: adminGroupId,
      requiredQuorum: 2,
    });

    // 1. Admin 1 clicks
    const req1 = new Request("https://example.com/api/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": secretToken,
      },
      body: JSON.stringify({
        callback_query: {
          id: "cb_vote_1",
          from: { id: 101, username: "admin_alice", first_name: "Alice" },
          message: { chat: { id: adminGroupId }, message_id: 90 },
          data: callbackData,
        },
      }),
    });

    await handler(req1);
    // Not executed yet because quorum = 2!
    expect(onSuspendSpy).not.toHaveBeenCalled();
    expect(mockSessionManager.revokeAllSessions).not.toHaveBeenCalled();

    // 2. Admin 2 clicks
    const req2 = new Request("https://example.com/api/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": secretToken,
      },
      body: JSON.stringify({
        callback_query: {
          id: "cb_vote_2",
          from: { id: 102, username: "admin_bob", first_name: "Bob" },
          message: { chat: { id: adminGroupId }, message_id: 90 },
          data: callbackData,
        },
      }),
    });

    await handler(req2);
    // Quorum reached -> EXECUTED!
    expect(mockSessionManager.revokeAllSessions).toHaveBeenCalledWith("usr_compromised");
    expect(onSuspendSpy).toHaveBeenCalledWith("usr_compromised", expect.objectContaining({ id: 102 }));
  });

  it("handles admin text commands in the Admin Group (/status, /revoke, /killall)", async () => {
    const handler = createTelegramAdminWebhookHandler(
      {
        botToken: "fake_bot_token",
        adminGroupId,
        secretToken,
        sessionManager: mockSessionManager,
      },
      vault
    );

    // /status command
    const reqStatus = new Request("https://example.com/api/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": secretToken,
      },
      body: JSON.stringify({
        message: {
          chat: { id: adminGroupId },
          text: "/status",
        },
      }),
    });

    const resStatus = await handler(reqStatus);
    expect(resStatus.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("sendMessage"),
      expect.objectContaining({
        body: expect.stringContaining("NextSessionGuard SOC Status"),
      })
    );

    // /revoke command
    const reqRevoke = new Request("https://example.com/api/telegram-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": secretToken,
      },
      body: JSON.stringify({
        message: {
          chat: { id: adminGroupId },
          text: "/revoke sess_special_99",
        },
      }),
    });

    await handler(reqRevoke);
    expect(mockSessionManager.revokeSession).toHaveBeenCalledWith({
      sessionId: "sess_special_99",
      userId: "usr_99",
    });
  });
});
