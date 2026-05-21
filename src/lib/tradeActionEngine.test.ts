import { describe, expect, it } from "vitest";
import type { FfaContractRow, HedgeResult, PhysicalResult, SettlementResult, SignalResult } from "../types";
import { opportunityFixture, routeFixture } from "./testFixtures";
import { buildTradeActionPlan } from "./tradeActionEngine";

const contract: FfaContractRow = {
  trade_date: "2026-05-21",
  contract_code: "P6-FFA",
  settlement_index: "P6_82",
  period_type: "MONTH",
  period_start: "2026-05-01",
  period_end: "2026-05-31",
  price: 14200,
  bid: 14150,
  ask: 14250,
  unit: "$/day",
  lot_size: 1,
  source: "test fixture",
};

const physical: PhysicalResult = {
  actualGrossRevenue: 1_862_000,
  fuelCost: 520_000,
  voyageCosts: 276_000,
  commission: 46_550,
  actualTce: 23_708,
  physicalEdge: 10_458,
  benchmarkTce: 18_800,
  benchmarkFreightPerMt: 21,
  requiredFreightPerMt: 18.4,
  requiredTcOut: 15_900,
  shipSpecBasis: 4_908,
  componentPnl: {},
  warnings: [],
  sensitivity: [],
  formula: "test fixture",
};

const settlement: SettlementResult = {
  contractCode: "P6-FFA",
  rule: {
    contractCode: "P6-FFA",
    settlementIndex: "P6_82",
    unit: "$/day",
    settlementBasis: "MONTH_AVERAGE",
    sourceSeries: "P6_82",
    periodType: "MONTH",
    usesPublishedDaysOnly: true,
    missingDataPolicy: "ERROR",
  },
  observations: [],
  realized: [],
  remaining: [],
  missingObservationDates: [],
  realizedDays: 10,
  remainingDays: 11,
  expectedSettlement: 13_400,
  impliedRemaining: 14_100,
  paperEdgeShort: 800,
  paperEdgeLong: -800,
  formula: "test fixture",
  asOfDate: "2026-05-21",
  ruleVersion: "GMB v8.4",
  dataQualityWarnings: [],
  restatementHandling: "placeholder",
};

const hedge: HedgeResult = {
  notional: 43,
  notionalUnit: "days",
  roundedLots: 43,
  roundedNotional: 43,
  executionPrice: 14_150,
  transactionCosts: 430,
  marginRequirement: 61_060,
  residualExposure: 0,
  effectivenessScore: 0.88,
  paperPnl: 32_250,
  formula: "test fixture",
};

const signal: SignalResult = {
  opportunity_id: opportunityFixture.opportunity_id,
  vessel: opportunityFixture.vessel_name,
  route: opportunityFixture.route_code,
  trade_type: "TC_IN_AND_VOYAGE",
  physical_edge: physical.physicalEdge,
  ship_spec_basis: physical.shipSpecBasis,
  scrubber_value: 0,
  paper_edge: settlement.paperEdgeShort,
  paper_unit: "$/day",
  route_basis: 420,
  normalized_paper_edge_per_day: settlement.paperEdgeShort,
  physical_pnl: physical.physicalEdge * opportunityFixture.voyage_days,
  paper_pnl: hedge.paperPnl,
  hedge_pnl: hedge.paperPnl,
  residual_basis_pnl: -12_000,
  transaction_costs: hedge.transactionCosts,
  margin_carry_costs: hedge.marginRequirement * 0.02,
  final_risk_adjusted_pnl: 468_000,
  recommended_hedge: "P6-FFA",
  hedge_ratio: 1,
  net_signal: 5_100,
  confidence: 0.82,
  risk_flag: "CLEAR",
  recommendation: "STRONG LONG PHYSICAL / SHORT PAPER",
  explanation: "test fixture",
  formula: "test fixture",
};

describe("tradeActionEngine", () => {
  it("refuses to call an open TC-in ship an arbitrage", () => {
    const plan = buildTradeActionPlan({
      opportunity: { ...opportunityFixture, trade_type: "TC_IN_ONLY", employment_status: "NONE", freight_rate: 0 },
      route: routeFixture,
      contract,
      physical,
      settlement,
      hedge,
      signal: { ...signal, risk_flag: "NO_EMPLOYMENT_PLAN", recommendation: "DANGEROUS FALSE ARBITRAGE" },
      finalPnl: 200_000,
    });

    expect(plan.tradeClass).toBe("dangerous false arbitrage");
    expect(plan.paperSide).toBe("NONE");
    expect(plan.shipAction).toContain("secure either a cargo/spot voyage, a voyage relet, or a TC-out");
  });

  it("turns a positive TC-in voyage and rich FFA into a ship action plus paper order", () => {
    const plan = buildTradeActionPlan({
      opportunity: opportunityFixture,
      route: routeFixture,
      contract,
      physical,
      settlement,
      hedge,
      signal,
      finalPnl: 468_000,
    });

    expect(plan.tradeClass).toBe("basis trade");
    expect(plan.employmentMode).toBe("fix spot voyage");
    expect(plan.paperSide).toBe("SHORT");
    expect(plan.shipAction).toContain("Fix the spot voyage/cargo");
    expect(plan.derivativeAction).toContain("Sell/short P6-FFA");
  });
});
