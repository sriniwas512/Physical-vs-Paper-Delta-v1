import type {
  FfaContractRow,
  HedgeResult,
  PhysicalOpportunityRow,
  PhysicalResult,
  RiskFlag,
  RouteDistanceRow,
  ScrubberResult,
  SettlementResult,
  SignalResult,
  VesselSpecRow,
} from "../types";
import { normalizePaperEdge } from "./economicNormalization";
import { calculateRouteBasis } from "./routeBasisEngine";

export function calculateSignal(input: {
  opportunity: PhysicalOpportunityRow;
  vessel: VesselSpecRow;
  route: RouteDistanceRow;
  physical: PhysicalResult;
  scrubber: ScrubberResult;
  settlement: SettlementResult;
  hedge: HedgeResult;
  ffa: FfaContractRow;
  transactionCosts?: number;
  hedgeCosts?: number;
  marginCost?: number;
  basisRiskReserve?: number;
  idleDayRisk?: number;
  indexData?: import("../types").BalticIndexRow[];
}): SignalResult {
  const exposureDays = input.opportunity.voyage_days || input.opportunity.laden_days + input.opportunity.ballast_days;
  const normalizedPaper = normalizePaperEdge({
    unit: input.settlement.rule.unit,
    side: "SHORT",
    entryPrice: input.ffa.price,
    expectedSettlement: input.settlement.expectedSettlement,
    cargoQty: input.opportunity.cargo_qty,
    exposureDays,
    hedgeRatio:
      input.hedge.notionalUnit === "mt"
        ? input.hedge.roundedNotional / Math.max(input.opportunity.cargo_qty, 1)
        : input.hedge.roundedNotional / Math.max(exposureDays, 1),
  });
  const routeBasisStats = calculateRouteBasis({
    indexData: input.indexData ?? [],
    physicalExposure: input.route.exposure,
    hedgeIndex: input.ffa.settlement_index,
  });
  const routeBasis = -routeBasisStats.residualBasisRisk;
  const physicalPnl = input.physical.physicalEdge * exposureDays;
  const residualBasisPnl = routeBasis * exposureDays;
  const marginCarryCost = input.hedge.marginRequirement * 0.02;
  const deductions =
    (input.transactionCosts ?? 75) +
    (input.hedgeCosts ?? 40) +
    (input.marginCost ?? 35) +
    (input.basisRiskReserve ?? 120) +
    (input.idleDayRisk ?? 80);
  const paperEdge = input.settlement.paperEdgeShort;
  const netSignal = input.physical.shipSpecBasis + normalizedPaper.usdPerDayEq + routeBasis + input.scrubber.scrubberValuePerDay - deductions;
  const finalRiskAdjustedPnl =
    physicalPnl + normalizedPaper.usdTotal + residualBasisPnl - input.hedge.transactionCosts - marginCarryCost;
  const riskFlag = firstRiskFlag(input, routeBasis);
  const recommendation = recommendationFor({
    riskFlag,
    netSignal,
    shipSpecBasis: input.physical.shipSpecBasis,
    paperEdge,
    hasEmployment: hasEmployment(input.opportunity),
  });

  return {
    opportunity_id: input.opportunity.opportunity_id,
    vessel: input.vessel.vessel_name,
    route: input.opportunity.route_code,
    trade_type: input.opportunity.trade_type,
    physical_edge: input.physical.physicalEdge,
    ship_spec_basis: input.physical.shipSpecBasis,
    scrubber_value: input.scrubber.scrubberValuePerDay,
    paper_edge: paperEdge,
    paper_unit: input.settlement.rule.unit,
    route_basis: routeBasis,
    normalized_paper_edge_per_day: normalizedPaper.usdPerDayEq,
    physical_pnl: physicalPnl,
    paper_pnl: normalizedPaper.usdTotal,
    hedge_pnl: input.hedge.paperPnl,
    residual_basis_pnl: residualBasisPnl,
    transaction_costs: input.hedge.transactionCosts,
    margin_carry_costs: marginCarryCost,
    final_risk_adjusted_pnl: finalRiskAdjustedPnl,
    recommended_hedge: input.ffa.settlement_index,
    hedge_ratio: routeBasisStats.recommendedHedgeRatio || Math.min(1, Math.max(0.35, 1 - Math.abs(routeBasis) / 2500)),
    net_signal: netSignal,
    confidence: riskFlag === "CLEAR" ? Math.round(routeBasisStats.confidence || 82) : riskFlag === "ROUTE_MISMATCH" ? 45 : 40,
    risk_flag: riskFlag,
    recommendation,
    explanation: explain(input, riskFlag),
    formula: `Combined short signal = ship spec basis ${round(input.physical.shipSpecBasis)} $/day + normalized paper ${round(normalizedPaper.usdPerDayEq)} $/day equivalent + route residual ${round(routeBasis)} $/day + scrubber ${round(input.scrubber.scrubberValuePerDay)} $/day - costs/reserves ${deductions}. Native paper edge remains ${round(paperEdge)} ${input.settlement.rule.unit}. ${normalizedPaper.formula} Route model: ${routeBasisStats.formula}`,
  };
}

function firstRiskFlag(input: Parameters<typeof calculateSignal>[0], routeBasis: number): RiskFlag | "CLEAR" {
  if (!hasEmployment(input.opportunity)) return "NO_EMPLOYMENT_PLAN";
  if (input.settlement.rule.unit !== input.ffa.unit) return "UNIT_MISMATCH";
  if (input.settlement.rule.settlementBasis === "LAST_7_PUBLISHED_DAYS" && input.opportunity.voyage_days > 20) return "SETTLEMENT_MISMATCH";
  if (Math.abs(routeBasis) > 500) return "ROUTE_MISMATCH";
  if (input.scrubber.warning) return "SCRUBBER_CAPTURE_ERROR";
  if (!input.settlement.observations.length) return "MISSING_SETTLEMENT_DAYS";
  if (input.ffa.ask - input.ffa.bid > input.ffa.price * 0.04) return "ILLIQUID_HEDGE";
  return "CLEAR";
}

function recommendationFor(input: {
  riskFlag: RiskFlag | "CLEAR";
  netSignal: number;
  shipSpecBasis: number;
  paperEdge: number;
  hasEmployment: boolean;
}): SignalResult["recommendation"] {
  if (!input.hasEmployment) return "DANGEROUS FALSE ARBITRAGE";
  if (input.riskFlag !== "CLEAR" && input.netSignal < 250) return "NO TRADE";
  if (input.shipSpecBasis > 500 && input.paperEdge > 300) return "STRONG LONG PHYSICAL / SHORT PAPER";
  if (input.shipSpecBasis > 500) return "LONG PHYSICAL ONLY";
  if (Math.abs(input.paperEdge) > 500) return "PAPER ONLY";
  return "NO TRADE";
}

function explain(input: Parameters<typeof calculateSignal>[0], riskFlag: RiskFlag | "CLEAR"): string {
  const isBlpg = input.route.benchmark_family === "BLPG";
  const routeNames = Object.entries(input.route.exposure)
    .filter(([, weight]) => weight > 0)
    .map(([route, weight]) => `${Math.round(weight * 100)}% ${route}`)
    .join(", ");
  return `User is long physical ${input.vessel.segment === "VLGC" ? "VLGC" : "Panamax"} on ${input.opportunity.load_port}-${input.opportunity.discharge_port}. Closest paper hedge is ${input.ffa.settlement_index} because the route exposure maps to ${routeNames}. ${isBlpg ? `${input.ffa.contract_code} settles in $/mt, so hedge notional is cargo tonnes, not vessel days.` : `${input.ffa.contract_code} settles in $/day, so hedge notional is exposure days.`} The real ship basis versus the Baltic artificial ship is ${round(input.physical.shipSpecBasis)} $/day and paper edge for a short is ${round(input.settlement.paperEdgeShort)}. Residual risk flag: ${riskFlag}.`;
}

const hasEmployment = (opportunity: PhysicalOpportunityRow) =>
  opportunity.trade_type !== "TC_IN_ONLY" || opportunity.employment_status !== "NONE";
const round = (value: number) => Math.round(value * 100) / 100;
