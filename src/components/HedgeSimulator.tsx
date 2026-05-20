import { calculateSettlement, settlementRules } from "../lib/settlementEngine";
import { simulateHedge } from "../lib/hedgeEngine";
import { calculatePhysicalEconomics } from "../lib/physicalEngine";
import { benchmarkShips } from "../data/mockData";
import { money } from "../lib/format";
import { defaultContractByMode, isFfaInMode, opportunitiesInMode } from "../lib/marketMode";
import { useLabStore } from "../store";
import { Field, Metric, Panel, Tag } from "./common";

export function HedgeSimulator() {
  const state = useLabStore();
  const activeOpportunities = opportunitiesInMode(state.opportunities, state.routes, state.marketMode);
  const activeFfas = state.ffas.filter((ffa) => isFfaInMode(ffa, state.marketMode));
  const opportunity = activeOpportunities.find((item) => item.opportunity_id === state.selectedOpportunityId);
  if (!opportunity) return <Panel title="Hedge Simulator" description="Missing opportunity."><div className="empty-state">Insufficient data: selected opportunity is missing.</div></Panel>;
  const vessel = state.vessels.find((item) => item.vessel_name === opportunity.vessel_name);
  const route = state.routes.find((item) => item.route_code === opportunity.route_code);
  if (!vessel || !route) return <Panel title="Hedge Simulator" description="Missing physical inputs."><div className="empty-state">Insufficient data: vessel or route is missing.</div></Panel>;
  const bunker = state.bunkers.find((item) => item.port === (route.benchmark_family === "BLPG" ? "Houston" : "Singapore"));
  if (!bunker) return <Panel title="Hedge Simulator" description="Missing bunker inputs."><div className="empty-state">Insufficient data: matching bunker port is missing.</div></Panel>;
  const benchmark = benchmarkShips[route.benchmark_family === "BLPG" ? "VLGC84_STANDARD_SHIP" : "BPI82_STANDARD_SHIP"];
  const physical = calculatePhysicalEconomics({ opportunity, vessel, route, bunker, benchmarkShip: benchmark });
  const contract =
    activeFfas.find((item) => item.contract_code === state.selectedContractCode) ??
    activeFfas.find((item) => item.contract_code === defaultContractByMode[state.marketMode]);
  if (!contract) return <Panel title="Hedge Simulator" description="Missing paper inputs."><div className="empty-state">Insufficient data: selected FFA contract is missing.</div></Panel>;
  const settlement = calculateSettlement(contract, settlementRules[contract.contract_code], state.baltic, {
    asOfDate: state.asOfDate,
    forecastMode: state.forecastMode,
  });
  const hedge = simulateHedge({
    unit: contract.unit,
    side: state.hedgeSide,
    cargoQty: opportunity.cargo_qty,
    exposureDays: opportunity.voyage_days,
    hedgeRatio: state.hedgeRatio,
    entryPrice: contract.price,
    settlementPrice: settlement.expectedSettlement,
    bid: contract.bid,
    ask: contract.ask,
    lotSize: contract.lot_size,
    slippage: Math.max(contract.ask - contract.bid, 0) * 0.1,
  });
  const physicalPnl = physical.physicalEdge * opportunity.voyage_days;
  const finalRiskAdjustedPnl = physicalPnl + hedge.paperPnl - hedge.transactionCosts;

  return (
    <Panel title="Hedge Simulator" description="Correct notional sizing for $/day freight paper and BLPG $/mt instruments.">
      <div className="toolbar">
        <Field label="Hedge ratio">
          <input type="range" min="0" max="1.5" step="0.05" value={state.hedgeRatio} onChange={(event) => state.setHedgeRatio(Number(event.target.value))} />
        </Field>
        <Tag>{Math.round(state.hedgeRatio * 100)}% hedge</Tag>
        <Tag tone={contract.unit === "$/mt" ? "warn" : "neutral"}>{hedge.roundedNotional.toLocaleString()} {hedge.notionalUnit} · {hedge.roundedLots} lots</Tag>
      </div>
      <div className="metric-grid four">
        <Metric label="Physical PnL" value={money(physicalPnl)} formula="Physical edge x physical exposure days." tone={physicalPnl > 0 ? "good" : "bad"} />
        <Metric label="Paper PnL" value={money(hedge.paperPnl)} formula={hedge.formula} tone={hedge.paperPnl > 0 ? "good" : "bad"} />
        <Metric label="Final risk-adjusted PnL" value={money(finalRiskAdjustedPnl)} formula="Physical PnL + paper PnL - transaction/slippage costs." tone={finalRiskAdjustedPnl > 0 ? "good" : "bad"} />
        <Metric label="Margin / carry" value={money(hedge.marginRequirement)} formula="Rounded notional x execution price x margin rate." />
      </div>
      <div className="registry-rules">
        <div><b>Normalized $/day</b><span>{contract.unit === "$/mt" ? "Converted via total USD PnL / voyage days for signal display; raw paper remains $/mt." : "Native $/day paper."}</span></div>
        <div><b>Residual exposure</b><span>{hedge.residualExposure.toFixed(2)} {hedge.notionalUnit}; effectiveness {Math.round(hedge.effectivenessScore)}%</span></div>
        <div><b>Warnings</b><span>{hedge.warnings?.length ? hedge.warnings.join(" · ") : "CLEAR"}</span></div>
      </div>
    </Panel>
  );
}
