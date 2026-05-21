import { useMemo } from "react";
import { calculatePhysicalEconomics } from "../lib/physicalEngine";
import { calculateScrubberValue } from "../lib/scrubberEngine";
import { calculateSettlement, settlementRules } from "../lib/settlementEngine";
import { simulateHedge } from "../lib/hedgeEngine";
import { calculateSignal } from "../lib/signalEngine";
import { createAuditRun, saveAuditRun } from "../lib/auditStore";
import { benchmarkShips } from "../data/mockData";
import { money, rate } from "../lib/format";
import { useLabStore } from "../store";
import { Panel, Tag } from "./common";
import { toBalticPublicationCalendar } from "../lib/calendar";

export function TradeExecutionPlan() {
  const state = useLabStore();
  const analysis = useMemo(() => buildExecutionAnalysis(state), [state]);

  if ("missing" in analysis) {
    return <Panel title="Trade Execution Plan" description="Actionable plan."><div className="empty-state">Insufficient data: {analysis.missing}</div></Panel>;
  }

  const { opportunity, contract, rule, physical, settlement, hedge, signal, physicalPnl, finalPnl, classification, audit } = analysis;

  return (
    <Panel title="Trade Execution Plan" description="Specific physical and paper actions generated from rule-traced calculations.">
      <div className="toolbar">
        <Tag tone={classification.includes("no trade") || classification.includes("dangerous") ? "bad" : "good"}>{classification}</Tag>
        <Tag>Audit source: {rule.gmbVersion}</Tag>
        <Tag>{audit.auditId}</Tag>
        <Tag>As-of {state.asOfDate}</Tag>
        <button onClick={() => saveAuditRun(audit)}>Save audit locally</button>
        <button onClick={() => navigator.clipboard.writeText(JSON.stringify(audit, null, 2))}>Copy audit JSON</button>
      </div>
      <div className="execution-grid">
        <div><b>Physical action</b><span>{physicalAction(signal.recommendation, opportunity.trade_type)}</span></div>
        <div><b>Paper action</b><span>{signal.recommendation === "NO TRADE" ? "Do not trade paper." : `Short ${contract.contract_code} at bid ${contract.bid}; hedge ${hedge.roundedLots} rounded lots.`}</span></div>
        <div><b>Hedge notional</b><span>{hedge.notional.toLocaleString()} {hedge.notionalUnit}; rounded {hedge.roundedNotional.toLocaleString()} {hedge.notionalUnit}</span></div>
        <div><b>Expected settlement</b><span>{rate(settlement.expectedSettlement, rule.unit)} using {rule.settlementBasis}</span></div>
        <div><b>Expected final PnL</b><span>{money(finalPnl)}</span></div>
        <div><b>Worst-case basis risk</b><span>{money(Math.abs(signal.route_basis * opportunity.voyage_days))}</span></div>
        <div><b>Stop-loss</b><span>{money(-Math.max(50000, Math.abs(finalPnl) * 0.35))} or route z-score beyond +/-2.</span></div>
        <div><b>Exit trigger</b><span>Exit if paper edge compresses below zero, employment changes, or GMB/data warning appears.</span></div>
      </div>
      <div className="explain-box">{signal.explanation}</div>
      <div className="registry-rules">
        <div><b>Risk-adjusted PnL bridge</b><span>Physical {money(physicalPnl)} + paper {money(hedge.paperPnl)} - transaction {money(hedge.transactionCosts)} - margin carry {money(hedge.marginRequirement * 0.02)} = {money(finalPnl)}</span></div>
        <div><b>Warnings</b><span>{[...settlement.dataQualityWarnings, ...(hedge.warnings ?? []), ...physical.warnings].join(" · ") || "CLEAR"}</span></div>
      </div>
    </Panel>
  );
}

function buildExecutionAnalysis(state: ReturnType<typeof useLabStore.getState>) {
  const opportunity = state.opportunities.find((item) => item.opportunity_id === state.selectedOpportunityId);
  const contract = state.ffas.find((item) => item.contract_code === state.selectedContractCode);
  if (!opportunity || !contract) return { missing: "opportunity or selected contract missing." };
  const vessel = state.vessels.find((item) => item.vessel_name === opportunity.vessel_name);
  const route = state.routes.find((item) => item.route_code === opportunity.route_code);
  if (!vessel || !route) return { missing: "vessel or route missing." };
  const bunker = state.bunkers.find((item) => item.port === (route.benchmark_family === "BLPG" ? "Houston" : "Singapore"));
  const rule = settlementRules[contract.contract_code];
  if (!bunker || !rule) return { missing: "bunker row or settlement rule missing." };
  const benchmark = benchmarkShips[route.benchmark_family === "BLPG" ? "VLGC84_STANDARD_SHIP" : "BPI82_STANDARD_SHIP"];
  const physical = calculatePhysicalEconomics({ opportunity, vessel, route, bunker, benchmarkShip: benchmark });
  const scrubber = calculateScrubberValue({
    vessel,
    opportunity,
    mode: state.scrubberMode,
    ownerSharePct: 50,
    hsfoPrice: bunker.HSFO,
    vlsfoPrice: bunker.VLSFO,
    eligibleScrubberSeaDays: opportunity.laden_days + opportunity.ballast_days,
    eligibleScrubberLadenDays: opportunity.laden_days,
    eligibleScrubberBallastDays: opportunity.ballast_days,
    scrubberOffDays: 1,
    extraScrubberOpexPerDay: 650,
    washwaterRestrictionAdjustment: 12000,
  });
  const settlement = calculateSettlement(contract, rule, state.baltic, {
    asOfDate: state.asOfDate,
    forecastMode: state.forecastMode,
    calendar: toBalticPublicationCalendar(state.publicationCalendar),
  });
  const hedge = simulateHedge({
    unit: rule.unit,
    side: "SHORT",
    cargoQty: opportunity.cargo_qty,
    exposureDays: opportunity.voyage_days,
    hedgeRatio: state.hedgeRatio,
    entryPrice: contract.price,
    settlementPrice: settlement.expectedSettlement,
    bid: contract.bid,
    ask: contract.ask,
    lotSize: contract.lot_size,
  });
  const signal = calculateSignal({ opportunity, vessel, route, physical, scrubber, settlement, hedge, ffa: contract, indexData: state.baltic });
  const physicalPnl = physical.physicalEdge * opportunity.voyage_days;
  const finalPnl = physicalPnl + hedge.paperPnl - hedge.transactionCosts - hedge.marginRequirement * 0.02;
  const classification = classify(signal.recommendation, signal.risk_flag);
  const audit = createAuditRun({
    sourceMetadata: [
      { name: "Baltic index rows", rows: state.baltic.length, versionId: `baltic-${state.baltic.length}` },
      { name: "FFA rows", rows: state.ffas.length, versionId: `ffas-${state.ffas.length}` },
      { name: "Bunker rows", rows: state.bunkers.length, versionId: `bunkers-${state.bunkers.length}` },
    ],
    opportunityId: opportunity.opportunity_id,
    contractCode: contract.contract_code,
    asOfDate: state.asOfDate,
    inputs: { opportunity, contract, rule, route, vessel },
    outputs: { physical, scrubber, settlement, hedge, signal, finalPnl },
    warnings: [...settlement.dataQualityWarnings, ...(hedge.warnings ?? []), ...physical.warnings],
    exportedReport: signal.explanation,
  });
  return { opportunity, contract, rule, physical, settlement, hedge, signal, physicalPnl, finalPnl, classification, audit };
}

function classify(recommendation: string, riskFlag: string): string {
  if (recommendation === "DANGEROUS FALSE ARBITRAGE" || riskFlag === "NO_EMPLOYMENT_PLAN") return "dangerous false arbitrage";
  if (recommendation === "STRONG LONG PHYSICAL / SHORT PAPER") return "basis trade";
  if (recommendation === "LONG PHYSICAL ONLY") return "physical-only trade";
  if (recommendation === "PAPER ONLY") return "paper-only trade";
  if (riskFlag === "CLEAR" && recommendation !== "NO TRADE") return "relative value trade";
  return "no trade";
}

function physicalAction(recommendation: string, tradeType: string): string {
  if (recommendation === "NO TRADE" || recommendation === "DANGEROUS FALSE ARBITRAGE") return "Do not add physical exposure until employment and hedge sizing are complete.";
  if (tradeType === "TC_IN_AND_VOYAGE") return "Fix the voyage/cargo employment only if bunker, laycan and route assumptions remain inside warning limits.";
  if (tradeType === "TC_IN_AND_TC_OUT") return "Lock TC-out cover and verify scrubber premium capture before paper execution.";
  return "Proceed with the selected physical exposure subject to warnings.";
}
