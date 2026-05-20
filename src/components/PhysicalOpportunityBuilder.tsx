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
  const opportunity = activeOpportunities.find((item) => item.opportunity_id === state.selectedOpportunityId);
  if (!opportunity) return <Panel title="Physical Opportunity Builder" description="Missing selected opportunity."><div className="empty-state">Insufficient data: selected opportunity not found.</div></Panel>;
  const vessel = state.vessels.find((item) => item.vessel_name === opportunity.vessel_name);
  const route = state.routes.find((item) => item.route_code === opportunity.route_code);
  if (!vessel || !route) return <Panel title="Physical Opportunity Builder" description="Missing physical inputs."><div className="empty-state">Insufficient data: vessel or route not found.</div></Panel>;
  const bunker = state.bunkers.find((item) => item.port === (route.benchmark_family === "BLPG" ? "Houston" : "Singapore"));
  if (!bunker) return <Panel title="Physical Opportunity Builder" description="Missing bunker input."><div className="empty-state">Insufficient data: matching bunker port not found.</div></Panel>;
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
          <Metric label="Required TC-out" value={rate(physical.requiredTcOut, "$/day")} formula="(TC-in hire x voyage days + fuel + voyage costs) / voyage days." />
          <Metric label="Scrubber value" value={rate(scrubber.scrubberValuePerDay, "$/day")} tone={scrubber.warning ? "warn" : "good"} formula={scrubber.formula} />
        </div>
      </div>
      <div className="economics-strip">
        <Tag>Gross revenue {money(physical.actualGrossRevenue)}</Tag>
        <Tag>Fuel {money(physical.fuelCost)}</Tag>
        <Tag>Costs {money(physical.voyageCosts)}</Tag>
        <Tag tone={route.benchmark_family === "BLPG" ? "warn" : "neutral"}>{route.benchmark_family === "BLPG" ? "BLPG $/mt paper kept separate from TCE" : "Panamax $/day paper"}</Tag>
      </div>
      <div className="registry-rules">
        <div><b>PnL by component</b><span>{Object.entries(physical.componentPnl).map(([key, value]) => `${key}: ${money(value)}`).join(" · ")}</span></div>
        <div><b>Sensitivity</b><span>{physical.sensitivity.map((item) => `${item.label}: ${money(item.value, item.unit)}`).join(" · ")}</span></div>
        <div><b>Warnings</b><span>{[...physical.warnings, ...(scrubber.warning ? [scrubber.warning] : [])].join(" · ") || "CLEAR"}</span></div>
      </div>
    </Panel>
  );
}
