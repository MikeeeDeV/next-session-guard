import { describe, it, expect } from "vitest";
import * as NSG from "../src/index";

describe("Public API exports (src/index.ts)", () => {
  it("exports all core engine functions and classes", () => {
    expect(NSG.SessionManager).toBeDefined();
    expect(typeof NSG.SessionManager).toBe("function");

    expect(typeof NSG.extractClientIp).toBe("function");
    expect(typeof NSG.extractGeoInfo).toBe("function");
    expect(typeof NSG.parseClientInfo).toBe("function");
    expect(typeof NSG.getClientMetadata).toBe("function");
    expect(typeof NSG.countryCodeToFlag).toBe("function");
  });

  it("exports UI components", () => {
    expect(NSG.ActiveSessionsCard).toBeDefined();
    expect(typeof NSG.ActiveSessionsCard).toBe("function");
  });

  it("exports API route helper factories", () => {
    expect(typeof NSG.createSessionsRouteHandlers).toBe("function");
    expect(typeof NSG.createRevokeOthersHandler).toBe("function");
  });

  it("exports middleware guard function", () => {
    expect(typeof NSG.sessionGuardMiddleware).toBe("function");
  });
});
