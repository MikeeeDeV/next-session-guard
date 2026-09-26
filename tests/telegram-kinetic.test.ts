import { describe, it, expect } from "vitest";
import {
  calculateKineticTravel,
  haversineDistance,
} from "../src/telegram/kinetic-travel";

describe("Kinetic Impossible Travel 2.0", () => {
  it("computes accurate Haversine distance between coordinates", () => {
    // Cairo (26.82, 30.80) to Frankfurt, Germany (51.16, 10.45) ~ approx 3100km
    const dist = haversineDistance(26.82, 30.8, 51.16, 10.45);
    expect(dist).toBeGreaterThan(2500);
    expect(dist).toBeLessThan(3500);
  });

  it("detects impossible supersonic travel (2800+ km in 10 minutes)", () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const now = new Date();

    const result = calculateKineticTravel(
      {
        country: "EG",
        city: "Cairo",
        timestamp: tenMinutesAgo,
      },
      {
        country: "DE",
        city: "Frankfurt",
        timestamp: now,
      }
    );

    expect(result).not.toBeNull();
    expect(result?.isImpossible).toBe(true);
    expect(result?.speedKmh).toBeGreaterThan(900); // Faster than Boeing 777
    expect(result?.description).toContain("Impossible Travel");
  });

  it("returns null for negligible distances (< 25km)", () => {
    const result = calculateKineticTravel(
      {
        latitude: 30.0444,
        longitude: 31.2357,
        timestamp: new Date(Date.now() - 60000),
      },
      {
        latitude: 30.05,
        longitude: 31.24,
        timestamp: new Date(),
      }
    );

    expect(result).toBeNull();
  });

  it("flags normal ground travel as not impossible", () => {
    // 5 hours between two cities in Egypt
    const fiveHoursAgo = new Date(Date.now() - 5 * 3600 * 1000);
    const now = new Date();

    const result = calculateKineticTravel(
      {
        latitude: 30.0444,
        longitude: 31.2357, // Cairo
        timestamp: fiveHoursAgo,
      },
      {
        latitude: 31.2001,
        longitude: 29.9187, // Alexandria ~ 180 km
        timestamp: now,
      }
    );

    expect(result).not.toBeNull();
    expect(result?.isImpossible).toBe(false);
    expect(result?.speedKmh).toBeLessThan(100);
  });
});
