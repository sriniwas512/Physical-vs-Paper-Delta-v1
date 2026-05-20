import { describe, expect, it } from "vitest";
import { calculatePaperPnl, simulateHedge, sizeHedgeNotional } from "./hedgeEngine";

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

  it("rounds BLPG hedges to lot size and reports residual exposure", () => {
    const hedge = simulateHedge({
      unit: "$/mt",
      side: "SHORT",
      cargoQty: 44000,
      hedgeRatio: 0.93,
      entryPrice: 120,
      settlementPrice: 110,
      bid: 119,
      lotSize: 1000,
    });

    expect(hedge.roundedLots).toBe(41);
    expect(hedge.roundedNotional).toBe(41000);
    expect(hedge.residualExposure).toBeCloseTo(-80);
    expect(hedge.paperPnl).toBe(369000);
  });

  it("calculates long paper pnl as settlement minus entry", () => {
    expect(calculatePaperPnl({ side: "LONG", notional: 10, entryPrice: 100, settlementPrice: 115 })).toBe(150);
  });
});
