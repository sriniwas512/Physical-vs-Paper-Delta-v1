import { describe, expect, it } from "vitest";
import { calculatePaperPnl, sizeHedgeNotional } from "./hedgeEngine";

describe("hedgeEngine", () => {
  it("sizes day-rate paper in vessel days", () => {
    expect(sizeHedgeNotional({ unit: "$/day", exposureDays: 42, hedgeRatio: 0.75 })).toEqual({
      notional: 31.5,
      unit: "days",
      warning: undefined,
    });
  });

  it("sizes BLPG paper in cargo tonnes instead of days", () => {
    expect(sizeHedgeNotional({ unit: "$/mt", cargoQty: 44000, hedgeRatio: 0.5 })).toEqual({
      notional: 22000,
      unit: "mt",
      warning: undefined,
    });
  });

  it("flags BLPG paper sizing when cargo program is absent", () => {
    expect(sizeHedgeNotional({ unit: "$/mt", exposureDays: 30, hedgeRatio: 1 }).warning).toContain(
      "Cannot size BLPG paper hedge properly",
    );
  });

  it("calculates short paper pnl as notional times entry minus settlement", () => {
    expect(calculatePaperPnl({ side: "SHORT", notional: 44000, entryPrice: 120, settlementPrice: 110 })).toBe(440000);
  });
});
