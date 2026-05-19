import { calculateSettlement, settlementRules } from "../lib/settlementEngine";
import { simulateHedge } from "../lib/hedgeEngine";
import { calculatePhysicalEconomics } from "../lib/physicalEngine";
import { benchmarkShips } from "../data/mockData";
import { money, rate } from "../lib/format";
import { defaultContractByMode, isFfaInMode, opportunitiesInMode } from "../lib/marketMode";
import { useLabStore } from "../store";
import { Field, Metric, Panel, Tag } from "./common";

export function HedgeSimulator() {
  const state = useLabStore();
  const activeOpportunities = opportunitiesInMode(state.opportunities, state.routes, state.marketMode);
  const activeFfas = state.ffas.filter((ffa) => isFfaInMode(ffa, state.marketMode));
  const opportunity = activeOpportunities.find((item) => item.opportunity_id === state.selectedOpportunityId) ?? activeOpportunities[0];
  const vessel = state.vessels.find((item) => item.vessel_name === opportunity.vessel_name) ?? state.vessels[0];
  const route = state.routes.find((item) => item.route_code === opportunity.route_code) ?? state.routes[0];
  const bunker = state.bunkers[route.benchmark_family === "BLPG" ? 1 : 0];
  const benchmark = benchmarkShips[route.benchmark_family === "BLPG" ? "VLGC84_STANDARD_SHIP" : "BPI82_STANDARD_SHIP"];
  const physical = calculatePhysicalEconomics({ opportunity, vessel, route, bunker, benchmarkShip: benchmark });
  const contract =
    activeFfas.find((item) => item.contract_code === state.selectedContractCode) ??
    activeFfas.find((item) => item.contract_code === defaultContractByMode[state.marketMode]) ??
    activeFfas[0];
  const settlement = calculateSettlement(contract, settlementRules[contract.contract_code], state.baltic, {
    asOfDate: "2026-05-14",
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
  });
  const physicalPnl = physical.physicalEdge * opportunity.voyage_days;
  const netPnl = physicalPnl + hedge.paperPnl;

  return (
    <Panel title="Hedge Simulator" description="Correct notional sizing for $/day freight paper and BLPG $/mt instruments.">
      <div className="toolbar">
        <Field label="Hedge ratio">
          <input type="range" min="0" max="1.5" step="0.05" value={state.hedgeRatio} onChange={(event) => state.setHedgeRatio(Number(event.target.value))} />
        </Field>
        <Tag>{Math.round(state.hedgeRatio * 100)}% hedge</Tag>
        <Tag tone={contract.unit === "$/mt" ? "warn" : "neutral"}>{hedge.notional.toLocaleString()} {hedge.notionalUnit}</Tag>
      </div>
      <div className="metric-grid four">
        <Metric label="Physical PnL" value={money(physicalPnl)} formula="Physical edge x physical exposure days." tone={physicalPnl > 0 ? "good" : "bad"} />
        <Metric label="Paper PnL" value={money(hedge.paperPnl)} formula={hedge.formula} tone={hedge.paperPnl > 0 ? "good" : "bad"} />
        <Metric label="Net PnL" value={money(netPnl)} formula="Expected physical PnL + expected paper PnL." tone={netPnl > 0 ? "good" : "bad"} />
        <Metric label="Basis VaR proxy" value={rate(Math.abs(physical.shipSpecBasis) * 1.65, "$/day")} formula="Simple MVP proxy: 1.65 x absolute ship-spec basis." />
      </div>
      {hedge.warning ? <div className="warning-line">{hedge.warning}</div> : null}
    </Panel>
  );
}
