import { describe, it, expect } from "vitest";
import { IncidentDamper } from "../src/telegram/incident-damper";

describe("Incident Damper & Burst Collapse Engine", () => {
  it("keeps normal mode when incident rate is below threshold", () => {
    const damper = new IncidentDamper({ burstThreshold: 4, burstWindowSeconds: 10 });

    const check1 = damper.recordIncident({ userId: "u1", country: "US" });
    expect(check1.isBurst).toBe(false);
    expect(check1.batchCount).toBe(1);

    const check2 = damper.recordIncident({ userId: "u2", country: "EG" });
    expect(check2.isBurst).toBe(false);
    expect(check2.batchCount).toBe(2);
  });

  it("activates burst collapse mode when threshold is reached", () => {
    const damper = new IncidentDamper({ burstThreshold: 3, burstWindowSeconds: 10 });

    damper.recordIncident({ userId: "u1", country: "RU" });
    damper.recordIncident({ userId: "u2", country: "RU" });
    const check3 = damper.recordIncident({ userId: "u3", country: "CN" });

    expect(check3.isBurst).toBe(true);
    expect(check3.batchCount).toBe(3);
    expect(check3.topCountries).toContain("RU (2)");
  });

  it("attaches and retains active burst message ID", () => {
    const damper = new IncidentDamper({ burstThreshold: 2 });
    damper.recordIncident({ userId: "u1" });
    damper.recordIncident({ userId: "u2" });

    damper.setActiveBurstMessage(-100123456, 999);
    const check = damper.recordIncident({ userId: "u3" });

    expect(check.isBurst).toBe(true);
    expect(check.activeBurstMessageId).toBe(999);
    expect(check.activeBurstChatId).toBe(-100123456);
  });
});
