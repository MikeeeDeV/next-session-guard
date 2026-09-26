import { NewDeviceContext } from "../core/types";
import { calculateKineticTravel } from "./kinetic-travel";
import { RiskAnalysis, RiskLevel } from "./types";

/**
 * Common Datacenter / Cloud / Hosting ASN indicators and IP subnets
 */
const KNOWN_HOSTING_PATTERNS = [
  /amazon/i,
  /aws/i,
  /google\s*cloud/i,
  /digitalocean/i,
  /hetzner/i,
  /ovh/i,
  /linode/i,
  /vultr/i,
  /cloudflare/i,
  /hosting/i,
  /server/i,
];

/**
 * Dynamic Risk Scoring & Threat Analysis Engine
 */
export function calculateRiskScore(
  context: NewDeviceContext,
  options?: {
    enableKineticTravel?: boolean;
    ipAsnOrIsp?: string;
  }
): RiskAnalysis {
  let score = 0;
  const reasons: string[] = [];

  const { newSession, existingSessions, isNewBrowser, isNewOS, isNewLocation, isNewIP } = context;

  // 1. Kinetic Impossible Travel Analysis
  let kineticResult = null;
  if (options?.enableKineticTravel !== false && existingSessions.length > 0) {
    // Find the most recent active session for comparison
    const sorted = [...existingSessions].sort((a, b) => {
      const timeA = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
      const timeB = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
      return timeB - timeA;
    });

    const previousSession = sorted[0];
    if (previousSession && (previousSession.country || previousSession.latitude)) {
      kineticResult = calculateKineticTravel(
        {
          country: previousSession.country,
          city: previousSession.city,
          latitude: previousSession.latitude,
          longitude: previousSession.longitude,
          timestamp: previousSession.lastActiveAt || previousSession.createdAt,
        },
        {
          country: newSession.country,
          city: newSession.city,
          latitude: newSession.latitude,
          longitude: newSession.longitude,
          timestamp: newSession.lastActiveAt || newSession.createdAt || new Date(),
        }
      );

      if (kineticResult) {
        if (kineticResult.isImpossible) {
          score += 65;
          reasons.push(
            `🚀 Impossible Travel detected: ${kineticResult.distanceKm.toLocaleString()} km at ~${kineticResult.speedKmh.toLocaleString()} km/h (${kineticResult.previousLocation} ➔ ${kineticResult.currentLocation})`
          );
        } else if (kineticResult.speedKmh > 200) {
          score += 25;
          reasons.push(
            `⚡ High-velocity transition: ${kineticResult.distanceKm.toLocaleString()} km at ~${kineticResult.speedKmh.toLocaleString()} km/h`
          );
        }
      }
    }
  }

  // 2. Location Drift
  if (isNewLocation) {
    score += 20;
    reasons.push(`🌍 New login country: ${newSession.country || "Unknown"}`);
  }

  // 3. Device & OS Drift
  if (isNewBrowser && isNewOS) {
    score += 25;
    reasons.push(`💻 Completely unrecognized device & OS: ${newSession.browser} on ${newSession.os}`);
  } else if (isNewOS) {
    score += 15;
    reasons.push(`💻 New operating system detected: ${newSession.os}`);
  } else if (isNewBrowser) {
    score += 10;
    reasons.push(`🌐 New browser detected: ${newSession.browser}`);
  }

  // 4. IP Drift
  if (isNewIP) {
    score += 10;
    reasons.push(`📡 Unfamiliar IP address: ${newSession.ipAddress || "Unknown"}`);
  }

  // 5. Cloud/Hosting IP Check
  if (options?.ipAsnOrIsp) {
    const isHosting = KNOWN_HOSTING_PATTERNS.some((pattern) => pattern.test(options.ipAsnOrIsp!));
    if (isHosting) {
      score += 25;
      reasons.push(`🏢 Datacenter/Hosting provider IP: ${options.ipAsnOrIsp}`);
    }
  }

  // Baseline if nothing flagged but it was triggered
  if (reasons.length === 0) {
    score = 15;
    reasons.push("ℹ️ Routine device verification");
  }

  // Normalize score between 0 and 100
  const normalizedScore = Math.min(Math.max(score, 0), 100);

  // Categorize Risk Level
  let level: RiskLevel;
  if (normalizedScore >= 80) {
    level = "CRITICAL";
  } else if (normalizedScore >= 60) {
    level = "HIGH";
  } else if (normalizedScore >= 30) {
    level = "MEDIUM";
  } else {
    level = "LOW";
  }

  return {
    score: normalizedScore,
    level,
    reasons,
    kinetic: kineticResult || undefined,
  };
}
