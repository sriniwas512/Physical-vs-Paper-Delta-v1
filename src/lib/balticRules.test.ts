import { describe, expect, it } from "vitest";
import { benchmarkShips, routes } from "../data/mockData";
import {
  balticHeadlineRules,
  p5tcFormula,
  settlementRules,
} from "./settlementEngine";

describe("latest Baltic paper rules", () => {
  it("stores the May 2026 BPI headline multiplier separately from P5TC", () => {
    expect(balticHeadlineRules.BPI.multiplier).toBe(0.111111);
    expect(balticHeadlineRules.BPI.componentFormula).toEqual([
      { indexCode: "P1A_82", weight: 0.25 },
      { indexCode: "P2A_82", weight: 0.1 },
      { indexCode: "P3A_82", weight: 0.25 },
      { indexCode: "P4_82", weight: 0.1 },
      { indexCode: "P6_82", weight: 0.3 },
    ]);
    expect(p5tcFormula).toEqual(balticHeadlineRules.BPI.componentFormula);
  });

  it("uses full BPI82 and VLGC84 paper benchmark vessel assumptions from the guide", () => {
    expect(benchmarkShips.BPI82_STANDARD_SHIP).toMatchObject({
      dwt: 82500,
      draft: 14.43,
      max_age: 12,
      loa: 229,
      beam: 32.25,
      tpc: 70.5,
      grain_cbm: 97000,
      scrubber_fitted: false,
      mgo_at_sea: 0.1,
    });
    expect(benchmarkShips.VLGC84_STANDARD_SHIP).toMatchObject({
      dwt: 54500,
      cbm: 84000,
      scrubber_fitted: false,
      loa: 225,
      beam: 36.5,
      draft: 12,
      ballast_speed: 16,
      ballast_consumption: 43,
      laden_speed: 16,
      laden_consumption: 48,
      eco_ballast_speed: 13.5,
      eco_laden_speed: 13,
      port_working_consumption: 10,
      port_idle_consumption: 5,
    });
  });

  it("includes the latest listed Panamax and LPG FFA settlement rules", () => {
    expect(settlementRules["P1A_03-FFA"]).toMatchObject({
      settlementIndex: "P1A_03",
      unit: "$/pt",
      settlementBasis: "MONTH_AVERAGE",
      derivedAdjustment: -1284,
    });
    expect(settlementRules["P1A_82-FFA"]).toMatchObject({
      settlementIndex: "P1A_82",
      unit: "$/day",
      settlementBasis: "LAST_7_PUBLISHED_DAYS",
    });
    expect(settlementRules["P1EA_82-FFA"]).toMatchObject({
      settlementIndex: "P1A_82",
      unit: "$/day",
      settlementBasis: "MONTH_AVERAGE",
    });
    expect(settlementRules["BLPG3-FFA"]).toMatchObject({
      settlementIndex: "BLPG3",
      unit: "$/mt",
      settlementBasis: "MONTH_AVERAGE",
    });
  });

  it("keeps BLPG paper route assumptions explicit", () => {
    const blpg3 = routes.find((route) => route.route_code === "BLPG3_USG_JAPAN");
    expect(blpg3).toMatchObject({
      standard_waiting_days: 0.5,
      standard_load_days: 2,
      standard_discharge_days: 2,
      canal_required: true,
      standard_cargo_qty: 44000,
      standard_commission: 1.25,
      route_notes:
        "BLPG3 $/mt: Houston to Chiba via Panama Canal with 2 days total Panama waiting included. BLPG3-TCE: delivery Houston round voyage discharging Chiba, 2 days load, 2 days discharge, 0.5 day waiting.",
    });
  });
});
