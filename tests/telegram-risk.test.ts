import { describe, it, expect } from "vitest";
import { calculateRiskScore } from "../src/telegram/risk-engine";
import { NewDeviceContext } from "../src/core/types";

describe("Dynamic Risk Engine & Threat Scoring", () => {
  it("assigns CRITICAL risk level for impossible travel leaps", () => {
    const context: NewDeviceContext = {
      userId: "usr_alice",
      newSession: {
        browser: "Chrome",
        os: "Windows",
        deviceType: "desktop",
        country: "DE",
        city: "Frankfurt",
        createdAt: new Date(),
        lastActiveAt: new Date(),
      },
      isNewBrowser: true,
      isNewOS: false,
      isNewLocation: true,
      isNewIP: true,
      existingSessions: [
        {
          browser: "Safari",
          os: "iOS",
          country: "EG",
          city: "Cairo",
          lastActiveAt: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
        },
      ],
    };

    const analysis = calculateRiskScore(context, { enableKineticTravel: true });
    expect(analysis.score).toBeGreaterThanOrEqual(80);
    expect(analysis.level).toBe("CRITICAL");
    expect(analysis.kinetic?.isImpossible).toBe(true);
    expect(analysis.reasons.some((r) => r.includes("Impossible Travel"))).toBe(true);
  });

  it("assigns MEDIUM or HIGH risk for unrecognized device and datacenter IP", () => {
    const context: NewDeviceContext = {
      userId: "usr_bob",
      newSession: {
        browser: "Firefox",
        os: "Linux",
        deviceType: "desktop",
        ipAddress: "142.250.190.46",
      },
      isNewBrowser: true,
      isNewOS: true,
      isNewLocation: false,
      isNewIP: true,
      existingSessions: [],
    };

    const analysis = calculateRiskScore(context, {
      ipAsnOrIsp: "DigitalOcean Cloud LLC",
    });

    expect(analysis.score).toBeGreaterThanOrEqual(60);
    expect(["HIGH", "CRITICAL"]).toContain(analysis.level);
    expect(analysis.reasons.some((r) => r.includes("Datacenter"))).toBe(true);
  });

  it("assigns LOW or baseline score for familiar routine device checks", () => {
    const context: NewDeviceContext = {
      userId: "usr_charlie",
      newSession: {
        browser: "Chrome",
        os: "Windows",
        deviceType: "desktop",
      },
      isNewBrowser: false,
      isNewOS: false,
      isNewLocation: false,
      isNewIP: false,
      existingSessions: [],
    };

    const analysis = calculateRiskScore(context);
    expect(analysis.score).toBeLessThan(30);
    expect(analysis.level).toBe("LOW");
  });
});
