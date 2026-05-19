import { calculatePhysicalEconomics } from "../lib/physicalEngine";
import { calculateScrubberValue } from "../lib/scrubberEngine";
import { benchmarkShips } from "../data/mockData";
import { money, rate } from "../lib/format";
import { opportunitiesInMode } from "../lib/marketMode";
import { useLabStore } from "../store";
import { Field, Metric, Panel, Tag } from "./common";

export function PhysicalOpportunityBuilder() {
  const state = useLabStore();
  const activeOpportunities = opportunitiesInMode(state.opportunities, state.routes, state.marketMode);
  const opportunity = activeOpportunities.find((item) => item.opportunity_id === state.selectedOpportunityId) ?? activeOpportunities[0];
  const vessel = state.vessels.find((item) => item.vessel_name === opportunity.vessel_name) ?? state.vessels[0];
  const route = state.routes.find((item) => item.route_code === opportunity.route_code) ?? state.routes[0];
  const bunker = state.bunkers.find((item) => item.port === (route.benchmark_family === "BLPG" ? "Houston" : "Singapore")) ?? state.bunkers[0];
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
    scrubberOffDays: 1,
    extraScrubberOpexPerDay: 650,
    washwaterRestrictionAdjustment: 12000,
  });

  return (
    <Panel title="Physical Opportunity Builder" description="Actual ship economics versus the Baltic artificial benchmark ship.">
      <div className="builder-grid">
        <div className="form-grid">
          <Field label="Opportunity">
            <select value={state.selectedOpportunityId} onChange={(event) => state.setSelectedOpportunityId(event.target.value)}>
              {activeOpportunities.map((item) => (
                <option key={item.opportunity_id}>{item.opportunity_id}</option>
              ))}
            </select>
          </Field>
          <Field label="Scrubber capture">
            <select value={state.scrubberMode} onChange={(event) => state.setScrubberMode(event.target.value as never)}>
              <option value="CHARTERER_RETAINS">Charterer retains</option>
              <option value="OWNER_RETAINS">Owner retains</option>
              <option value="SHARED">Shared</option>
              <option value="TC_OUT_MARKET_PREMIUM_ONLY">TC-out premium only</option>
            </select>
          </Field>
          <div className="detail-list">
            <span><b>Vessel</b>{vessel.vessel_name}</span>
            <span><b>Route</b>{opportunity.load_port} to {opportunity.discharge_port}</span>
            <span><b>Trade type</b>{opportunity.trade_type}</span>
            <span><b>Benchmark</b>{benchmark.label}</span>
            {route.route_notes ? <span><b>Paper route rule</b>{route.route_notes}</span> : null}
          </div>
        </div>
        <div className="metric-grid two">
          <Metric label="Actual TCE" value={rate(physical.actualTce, "$/day")} tone="good" formula={physical.formula} />
          <Metric label="TC-in hire" value={rate(opportunity.tc_in_hire, "$/day")} formula="Uploaded physical opportunity tc_in_hire." />
          <Metric label="Benchmark TCE" value={rate(physical.benchmarkTce, "$/day")} formula={physical.formula} />
          <Metric label="Ship basis" value={rate(physical.shipSpecBasis, "$/day")} tone={physical.shipSpecBasis > 0 ? "good" : "bad"} formula="Actual TCE - Baltic equivalent TCE." />
          <Metric label="Required freight" value={rate(physical.requiredFreightPerMt, "$/mt")} formula="(TC-in hire x voyage days + fuel + voyage costs) / cargo quantity." />
          <Metric label="Scrubber value" value={rate(scrubber.scrubberValuePerDay, "$/day")} tone={scrubber.warning ? "warn" : "good"} formula={scrubber.formula} />
        </div>
      </div>
      <div className="economics-strip">
        <Tag>Gross revenue {money(physical.actualGrossRevenue)}</Tag>
        <Tag>Fuel {money(physical.fuelCost)}</Tag>
        <Tag>Costs {money(physical.voyageCosts)}</Tag>
        <Tag tone={route.benchmark_family === "BLPG" ? "warn" : "neutral"}>{route.benchmark_family === "BLPG" ? "BLPG $/mt paper kept separate from TCE" : "Panamax $/day paper"}</Tag>
      </div>
    </Panel>
  );
}
