import { calculatePhysicalEconomics } from "../lib/physicalEngine";
import { calculateScrubberValue } from "../lib/scrubberEngine";
import { calculateSettlement, settlementRules } from "../lib/settlementEngine";
import { simulateHedge } from "../lib/hedgeEngine";
import { calculateSignal } from "../lib/signalEngine";
import { benchmarkShips } from "../data/mockData";
import { money, rate } from "../lib/format";
import { opportunitiesInMode } from "../lib/marketMode";
import { useLabStore } from "../store";
import { Panel, Tag } from "./common";

export function SignalMonitor() {
  const state = useLabStore();
  const activeOpportunities = opportunitiesInMode(state.opportunities, state.routes, state.marketMode);
  const signals = activeOpportunities.map((opportunity) => {
    const vessel = state.vessels.find((item) => item.vessel_name === opportunity.vessel_name) ?? state.vessels[0];
    const route = state.routes.find((item) => item.route_code === opportunity.route_code) ?? state.routes[0];
    const bunker = state.bunkers[route.benchmark_family === "BLPG" ? 1 : 0];
    const benchmark = benchmarkShips[route.benchmark_family === "BLPG" ? "VLGC84_STANDARD_SHIP" : "BPI82_STANDARD_SHIP"];
    const ffa =
      state.ffas.find((item) =>
        route.benchmark_family === "BLPG" ? item.contract_code === "BLPG3-FFA" : item.contract_code === "P6-FFA",
      ) ?? state.ffas[0];
    const settlement = calculateSettlement(ffa, settlementRules[ffa.contract_code], state.baltic, {
      asOfDate: "2026-05-14",
      forecastMode: state.forecastMode,
    });
    const physical = calculatePhysicalEconomics({ opportunity, vessel, route, bunker, benchmarkShip: benchmark });
    const scrubber = calculateScrubberValue({
      vessel,
      opportunity,
      mode: state.scrubberMode,
      ownerSharePct: 50,
      hsfoPrice: bunker.HSFO,
      vlsfoPrice: bunker.VLSFO,
      eligibleScrubberSeaDays: opportunity.laden_days + opportunity.ballast_days,
      scrubberOffDays: 1,
      extraScrubberOpexPerDay: 650,
      washwaterRestrictionAdjustment: 12000,
    });
    const hedge = simulateHedge({
      unit: ffa.unit,
      side: "SHORT",
      cargoQty: opportunity.cargo_qty,
      exposureDays: opportunity.voyage_days,
      hedgeRatio: state.hedgeRatio,
      entryPrice: ffa.price,
      settlementPrice: settlement.expectedSettlement,
    });
    return calculateSignal({ opportunity, vessel, route, physical, scrubber, settlement, hedge, ffa });
  });

  return (
    <Panel title="Signal Monitor" description="Basis/arbitrage labels with route, settlement, scrubber and employment risk flags.">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Opportunity</th>
              <th>Vessel</th>
              <th>Route</th>
              <th>Physical edge</th>
              <th>Ship basis</th>
              <th>Paper edge</th>
              <th>Hedge</th>
              <th>Net signal</th>
              <th>Risk</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => (
              <tr key={signal.opportunity_id} title={signal.formula}>
                <td>{signal.opportunity_id}</td>
                <td>{signal.vessel}</td>
                <td>{signal.route}</td>
                <td>{rate(signal.physical_edge, "$/day")}</td>
                <td>{rate(signal.ship_spec_basis, "$/day")}</td>
                <td>{rate(signal.paper_edge, "$/day")}</td>
                <td>{signal.recommended_hedge} · {Math.round(signal.hedge_ratio * 100)}%</td>
                <td>{money(signal.net_signal, "$", 0)}</td>
                <td><Tag tone={signal.risk_flag === "CLEAR" ? "good" : "warn"}>{signal.risk_flag}</Tag></td>
                <td><Tag tone={signal.recommendation.includes("STRONG") ? "good" : signal.recommendation === "NO TRADE" ? "bad" : "neutral"}>{signal.recommendation}</Tag></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="explain-box">{signals.find((signal) => signal.opportunity_id === state.selectedOpportunityId)?.explanation}</div>
    </Panel>
  );
}
