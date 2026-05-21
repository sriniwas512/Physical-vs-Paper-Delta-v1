import { useMemo } from "react";
import { calculatePhysicalEconomics } from "../lib/physicalEngine";
import { calculateScrubberValue } from "../lib/scrubberEngine";
import { calculateSettlement, settlementRules } from "../lib/settlementEngine";
import { simulateHedge } from "../lib/hedgeEngine";
import { calculateSignal } from "../lib/signalEngine";
import { createAuditRun, saveAuditRun } from "../lib/auditStore";
import { buildTradeActionPlan } from "../lib/tradeActionEngine";
import { benchmarkShips } from "../data/panamaxSeedData";
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

  const { opportunity, rule, physical, settlement, hedge, signal, physicalPnl, finalPnl, actionPlan, audit } = analysis;

  return (
    <Panel title="Trade Execution Plan" description="Specific physical and paper actions generated from rule-traced calculations.">
      <div className="toolbar">
        <Tag tone={actionPlan.tradeClass.includes("no trade") || actionPlan.tradeClass.includes("dangerous") ? "bad" : "good"}>{actionPlan.tradeClass}</Tag>
        <Tag>{actionPlan.employmentMode}</Tag>
        <Tag>{actionPlan.paperSide === "NONE" ? "No paper order" : `${actionPlan.paperSide} paper`}</Tag>
        <Tag>Audit source: {rule.gmbVersion}</Tag>
        <Tag>{audit.auditId}</Tag>
        <Tag>As-of {state.asOfDate}</Tag>
        <button onClick={() => saveAuditRun(audit)}>Save audit locally</button>
        <button onClick={() => navigator.clipboard.writeText(JSON.stringify(audit, null, 2))}>Copy audit JSON</button>
      </div>
      <div className="execution-grid">
        <div><b>What to do with the ship</b><span>{actionPlan.shipAction}</span></div>
        <div><b>Derivative order</b><span>{actionPlan.derivativeAction}</span></div>
        <div><b>Hedge notional</b><span>{hedge.notional.toLocaleString()} {hedge.notionalUnit}; rounded {hedge.roundedNotional.toLocaleString()} {hedge.notionalUnit}</span></div>
        <div><b>Expected settlement</b><span>{rate(settlement.expectedSettlement, rule.unit)} using {rule.settlementBasis}</span></div>
        <div><b>Expected final PnL</b><span>{money(finalPnl)}</span></div>
        <div><b>Worst-case basis risk</b><span>{money(Math.abs(signal.route_basis * opportunity.voyage_days))}</span></div>
        <div><b>Stop-loss</b><span>{actionPlan.stopLoss}</span></div>
        <div><b>Exit trigger</b><span>{actionPlan.exitTrigger}</span></div>
      </div>
      <div className="execution-list">
        <b>Execution sequence</b>
        <ol>
          {actionPlan.actionSteps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>
      <div className="execution-list danger-list">
        <b>Do not do</b>
        <ul>
          {actionPlan.doNotDo.map((step) => <li key={step}>{step}</li>)}
        </ul>
      </div>
      <div className="explain-box">{actionPlan.rationale}</div>
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
  const actionPlan = buildTradeActionPlan({ opportunity, route, contract, physical, settlement, hedge, signal, finalPnl });
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
    outputs: { physical, scrubber, settlement, hedge, signal, actionPlan, finalPnl },
    warnings: [...settlement.dataQualityWarnings, ...(hedge.warnings ?? []), ...physical.warnings],
    exportedReport: [
      `Ship action: ${actionPlan.shipAction}`,
      `Derivative action: ${actionPlan.derivativeAction}`,
      `Trade class: ${actionPlan.tradeClass}`,
      `Rationale: ${actionPlan.rationale}`,
      `Signal note: ${signal.explanation}`,
    ].join("\n"),
  });
  return { opportunity, contract, rule, physical, settlement, hedge, signal, physicalPnl, finalPnl, actionPlan, audit };
}
