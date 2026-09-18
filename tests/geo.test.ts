import { describe, it, expect } from "vitest";
import { extractGeoInfo } from "../src/core/ua-parser";

describe("extractGeoInfo", () => {
  // ── Vercel Headers ──────────────────────────────────────────────────────────

  describe("Vercel headers", () => {
    it("extracts country and city from Vercel headers", () => {
      const headers = new Headers({
        "x-vercel-ip-country": "EG",
        "x-vercel-ip-city": "Cairo",
      });
      const geo = extractGeoInfo(headers);
      expect(geo.country).toBe("EG");
      expect(geo.city).toBe("Cairo");
    });

    it("handles URL-encoded city names", () => {
      const headers = new Headers({
        "x-vercel-ip-country": "DE",
        "x-vercel-ip-city": "M%C3%BCnchen",
      });
      const geo = extractGeoInfo(headers);
      expect(geo.city).toBe("München");
    });

    it("extracts country without city", () => {
      const headers = new Headers({
        "x-vercel-ip-country": "US",
      });
      const geo = extractGeoInfo(headers);
      expect(geo.country).toBe("US");
      expect(geo.city).toBeUndefined();
    });
  });

  // ── Cloudflare Headers ──────────────────────────────────────────────────────

  describe("Cloudflare headers", () => {
    it("extracts country and city from Cloudflare headers", () => {
      const headers = new Headers({
        "cf-ipcountry": "SA",
        "cf-ipcity": "Riyadh",
      });
      const geo = extractGeoInfo(headers);
      expect(geo.country).toBe("SA");
      expect(geo.city).toBe("Riyadh");
    });

    it("ignores XX country code", () => {
      const headers = new Headers({
        "cf-ipcountry": "XX",
      });
      const geo = extractGeoInfo(headers);
      expect(geo.country).toBeUndefined();
    });
  });

  // ── AWS CloudFront Headers ──────────────────────────────────────────────────

  describe("AWS CloudFront headers", () => {
    it("extracts country and city from CloudFront headers", () => {
      const headers = new Headers({
        "cloudfront-viewer-country": "JP",
        "cloudfront-viewer-city": "Tokyo",
      });
      const geo = extractGeoInfo(headers);
      expect(geo.country).toBe("JP");
      expect(geo.city).toBe("Tokyo");
    });
  });

  // ── Fastly Headers ──────────────────────────────────────────────────────────

  describe("Fastly headers", () => {
    it("extracts country and city from Fastly headers", () => {
      const headers = new Headers({
        "x-client-geo-country": "GB",
        "x-client-geo-city": "London",
      });
      const geo = extractGeoInfo(headers);
      expect(geo.country).toBe("GB");
      expect(geo.city).toBe("London");
    });
  });

  // ── Priority & Fallback ─────────────────────────────────────────────────────

  describe("header priority", () => {
    it("prefers Vercel over Cloudflare headers", () => {
      const headers = new Headers({
        "x-vercel-ip-country": "EG",
        "x-vercel-ip-city": "Cairo",
        "cf-ipcountry": "US",
        "cf-ipcity": "New York",
      });
      const geo = extractGeoInfo(headers);
      expect(geo.country).toBe("EG");
      expect(geo.city).toBe("Cairo");
    });

    it("falls back to Cloudflare when Vercel headers are missing", () => {
      const headers = new Headers({
        "cf-ipcountry": "FR",
        "cf-ipcity": "Paris",
      });
      const geo = extractGeoInfo(headers);
      expect(geo.country).toBe("FR");
      expect(geo.city).toBe("Paris");
    });
  });

  // ── Empty / Missing Headers ─────────────────────────────────────────────────

  describe("missing headers", () => {
    it("returns undefined for both when no geo headers present", () => {
      const headers = new Headers();
      const geo = extractGeoInfo(headers);
      expect(geo.country).toBeUndefined();
      expect(geo.city).toBeUndefined();
    });

    it("handles plain object headers", () => {
      const headers = { "x-vercel-ip-country": "AE", "x-vercel-ip-city": "Dubai" };
      const geo = extractGeoInfo(headers);
      expect(geo.country).toBe("AE");
      expect(geo.city).toBe("Dubai");
    });
  });
});
