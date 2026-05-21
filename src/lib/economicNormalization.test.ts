import { describe, expect, it } from "vitest";
import { normalizePaperEdge } from "./economicNormalization";

describe("economicNormalization", () => {
  it("converts BLPG $/mt edge into USD total and USD/day equivalent", () => {
    const result = normalizePaperEdge({
      unit: "$/mt",
      side: "SHORT",
      entryPrice: 123,
      expectedSettlement: 118,
      cargoQty: 44000,
      exposureDays: 52,
      hedgeRatio: 1,
    });

    expect(result.usdTotal).toBe(220000);
    expect(result.usdPerDayEq).toBeCloseTo(4230.77, 2);
    expect(result.nativeUnit).toBe("$/mt");
  });

  it("converts day-rate paper into the same normalized interface", () => {
    const result = normalizePaperEdge({
      unit: "$/day",
      side: "SHORT",
      entryPrice: 15100,
      expectedSettlement: 14600,
      exposureDays: 40,
      hedgeRatio: 0.5,
    });

    expect(result.usdTotal).toBe(10000);
    expect(result.usdPerDayEq).toBe(250);
    expect(result.notionalUnit).toBe("days");
  });
});

