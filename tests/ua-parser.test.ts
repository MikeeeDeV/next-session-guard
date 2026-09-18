import { describe, it, expect } from "vitest";
import { parseClientInfo, extractClientIp, extractGeoInfo, countryCodeToFlag } from "../src/core/ua-parser";

// ── Real-world User-Agent strings ─────────────────────────────────────────────

const UA_CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const UA_SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";

const UA_FIREFOX_ANDROID =
  "Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0";

const UA_EDGE_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";

const UA_SAMSUNG_GALAXY =
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36";

const UA_SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15";

const UA_CHROME_IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";

const UA_OPERA_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0";

const UA_CHROME_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const UA_CHROMEOS =
  "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ── parseClientInfo Tests ─────────────────────────────────────────────────────

describe("parseClientInfo", () => {
  it("detects Chrome on Windows 10/11", () => {
    const result = parseClientInfo(UA_CHROME_WINDOWS);
    expect(result.browser).toBe("Chrome");
    expect(result.os).toBe("Windows 10/11");
    expect(result.deviceType).toBe("desktop");
  });

  it("detects Safari on iOS (iPhone)", () => {
    const result = parseClientInfo(UA_SAFARI_IOS);
    expect(result.browser).toBe("Safari");
    expect(result.os).toBe("iOS");
    expect(result.deviceType).toBe("mobile");
  });

  it("detects Firefox on Android", () => {
    const result = parseClientInfo(UA_FIREFOX_ANDROID);
    expect(result.browser).toBe("Firefox");
    expect(result.os).toBe("Android");
    expect(result.deviceType).toBe("mobile");
  });

  it("detects Edge on macOS", () => {
    const result = parseClientInfo(UA_EDGE_MAC);
    expect(result.browser).toBe("Microsoft Edge");
    expect(result.os).toBe("macOS");
    expect(result.deviceType).toBe("desktop");
  });

  it("detects Samsung Internet on Android", () => {
    const result = parseClientInfo(UA_SAMSUNG_GALAXY);
    expect(result.browser).toBe("Samsung Internet");
    expect(result.os).toBe("Android");
    expect(result.deviceType).toBe("mobile");
  });

  it("detects Safari on macOS", () => {
    const result = parseClientInfo(UA_SAFARI_MAC);
    expect(result.browser).toBe("Safari");
    expect(result.os).toBe("macOS");
    expect(result.deviceType).toBe("desktop");
  });

  it("detects tablet (iPad)", () => {
    const result = parseClientInfo(UA_CHROME_IPAD);
    expect(result.deviceType).toBe("tablet");
    expect(result.os).toBe("iPadOS");
  });

  it("detects Opera on Windows", () => {
    const result = parseClientInfo(UA_OPERA_WINDOWS);
    expect(result.browser).toBe("Opera");
    expect(result.os).toBe("Windows 10/11");
    expect(result.deviceType).toBe("desktop");
  });

  it("detects Chrome on Linux", () => {
    const result = parseClientInfo(UA_CHROME_LINUX);
    expect(result.browser).toBe("Chrome");
    expect(result.os).toBe("Linux");
    expect(result.deviceType).toBe("desktop");
  });

  it("detects Chrome OS", () => {
    const result = parseClientInfo(UA_CHROMEOS);
    expect(result.browser).toBe("Chrome");
    expect(result.os).toBe("Chrome OS");
    expect(result.deviceType).toBe("desktop");
  });

  it("handles empty user-agent string", () => {
    const result = parseClientInfo("");
    expect(result.browser).toBe("Unknown Browser");
    expect(result.os).toBe("Unknown OS");
    expect(result.deviceType).toBe("desktop");
  });

  it("handles null user-agent", () => {
    const result = parseClientInfo(null);
    expect(result.browser).toBe("Unknown Browser");
    expect(result.os).toBe("Unknown OS");
  });

  it("handles undefined user-agent", () => {
    const result = parseClientInfo(undefined);
    expect(result.browser).toBe("Unknown Browser");
  });

  it("includes IP address when provided", () => {
    const result = parseClientInfo(UA_CHROME_WINDOWS, "1.2.3.4");
    expect(result.ipAddress).toBe("1.2.3.4");
  });

  it("stores raw user-agent", () => {
    const result = parseClientInfo(UA_CHROME_WINDOWS);
    expect(result.rawUserAgent).toBe(UA_CHROME_WINDOWS);
  });
});

// ── extractClientIp Tests ─────────────────────────────────────────────────────

describe("extractClientIp", () => {
  it("extracts IP from cf-connecting-ip header", () => {
    const headers = new Headers({ "cf-connecting-ip": "203.0.113.50" });
    expect(extractClientIp(headers)).toBe("203.0.113.50");
  });

  it("extracts IP from x-forwarded-for (first IP)", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178" });
    expect(extractClientIp(headers)).toBe("203.0.113.50");
  });

  it("extracts IP from x-real-ip header", () => {
    const headers = new Headers({ "x-real-ip": "10.0.0.1" });
    expect(extractClientIp(headers)).toBe("10.0.0.1");
  });

  it("extracts IP from true-client-ip header", () => {
    const headers = new Headers({ "true-client-ip": "8.8.8.8" });
    expect(extractClientIp(headers)).toBe("8.8.8.8");
  });

  it("prefers cf-connecting-ip over x-forwarded-for", () => {
    const headers = new Headers({
      "cf-connecting-ip": "1.1.1.1",
      "x-forwarded-for": "2.2.2.2",
    });
    expect(extractClientIp(headers)).toBe("1.1.1.1");
  });

  it("returns 127.0.0.1 when no headers present", () => {
    const headers = new Headers();
    expect(extractClientIp(headers)).toBe("127.0.0.1");
  });

  it("skips localhost IPs (::1)", () => {
    const headers = new Headers({ "x-forwarded-for": "::1" });
    expect(extractClientIp(headers)).toBe("127.0.0.1");
  });

  it("skips 127.0.0.1 in forwarded headers", () => {
    const headers = new Headers({ "x-forwarded-for": "127.0.0.1" });
    expect(extractClientIp(headers)).toBe("127.0.0.1");
  });

  it("handles plain object headers (Record<string, string>)", () => {
    const headers = { "cf-connecting-ip": "5.5.5.5" };
    expect(extractClientIp(headers)).toBe("5.5.5.5");
  });

  it("handles plain object with array values", () => {
    const headers = { "x-forwarded-for": ["9.9.9.9", "8.8.8.8"] };
    expect(extractClientIp(headers)).toBe("9.9.9.9");
  });
});

// ── countryCodeToFlag Tests ───────────────────────────────────────────────────

describe("countryCodeToFlag", () => {
  it("converts EG to Egyptian flag", () => {
    expect(countryCodeToFlag("EG")).toBe("🇪🇬");
  });

  it("converts US to American flag", () => {
    expect(countryCodeToFlag("US")).toBe("🇺🇸");
  });

  it("converts SA to Saudi flag", () => {
    expect(countryCodeToFlag("SA")).toBe("🇸🇦");
  });

  it("handles lowercase country codes", () => {
    expect(countryCodeToFlag("gb")).toBe("🇬🇧");
  });

  it("returns empty string for invalid code", () => {
    expect(countryCodeToFlag("")).toBe("");
    expect(countryCodeToFlag("X")).toBe("");
    expect(countryCodeToFlag("XYZ")).toBe("");
  });
});
