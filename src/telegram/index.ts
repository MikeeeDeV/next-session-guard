import { NewDeviceContext } from "../core/types";
import { ActionVault } from "./action-vault";
import { IncidentDamper } from "./incident-damper";
import { TelegramNotifier } from "./notifier";
import { calculateRiskScore } from "./risk-engine";
import { TelegramAdminGuardConfig } from "./types";

export * from "./types";
export { ActionVault } from "./action-vault";
export { IncidentDamper } from "./incident-damper";
export { TelegramNotifier } from "./notifier";
export { calculateKineticTravel, haversineDistance } from "./kinetic-travel";
export { calculateRiskScore } from "./risk-engine";
export {
  markSessionAsGhost,
  isGhostSession,
  recordGhostTelemetry,
  getGhostSessionRecord,
  removeGhostStatus,
} from "./ghost-mode";
export { createTelegramAdminWebhookHandler } from "./webhook";

/**
 * Creates the Telegram Admin SOC Guard listener to attach directly
 * to SessionManager's `onNewDeviceDetected` callback.
 *
 * @example
 * ```typescript
 * const adminGuard = createTelegramAdminGuard({
 *   botToken: process.env.TELEGRAM_BOT_TOKEN!,
 *   adminGroupId: process.env.TELEGRAM_ADMIN_GROUP_ID!,
 *   secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
 *   minRiskScore: 40,
 * });
 *
 * export const sessionManager = new SessionManager(prisma, {
 *   onNewDeviceDetected: adminGuard.onNewDeviceDetected,
 * });
 * ```
 */
export function createTelegramAdminGuard(config: TelegramAdminGuardConfig) {
  const vault = new ActionVault(config.actionSecret);
  const notifier = new TelegramNotifier(config, vault);
  const damper = new IncidentDamper({
    burstThreshold: config.burstThreshold,
    burstWindowSeconds: config.burstWindowSeconds,
  });

  const onNewDeviceDetected = async (context: NewDeviceContext) => {
    try {
      // 1. Calculate dynamic risk score & threat analysis
      const risk = calculateRiskScore(context, {
        enableKineticTravel: config.enableKineticTravel !== false,
      });

      // Filter by minRiskScore if configured
      if (typeof config.minRiskScore === "number" && risk.score < config.minRiskScore) {
        return;
      }

      // 2. Incident Burst / Flood Check
      if (config.enableIncidentDamper !== false) {
        const burstCheck = damper.recordIncident({
          userId: context.userId,
          ipAddress: context.newSession.ipAddress,
          country: context.newSession.country,
        });

        if (burstCheck.isBurst) {
          // Update or send aggregated alert card
          const res = await notifier.sendOrUpdateBurstCard({
            messageId: burstCheck.activeBurstMessageId || undefined,
            batchCount: burstCheck.batchCount,
            topCountries: burstCheck.topCountries,
            sampleUserId: context.userId,
          });

          if (res?.result?.message_id && !burstCheck.activeBurstMessageId) {
            damper.setActiveBurstMessage(config.adminGroupId, res.result.message_id);
          }
          return;
        }
      }

      // 3. Normal Dispatch: Send full incident card with action buttons
      await notifier.sendSecurityAlert(context, risk);
    } catch (err) {
      console.error("[SessionGuard:Telegram] Error in onNewDeviceDetected:", err);
    }
  };

  return {
    onNewDeviceDetected,
    vault,
    notifier,
    damper,
    calculateRisk: (ctx: NewDeviceContext) =>
      calculateRiskScore(ctx, { enableKineticTravel: config.enableKineticTravel !== false }),
  };
}
