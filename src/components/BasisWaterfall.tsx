import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { benchmarkShips } from "../data/mockData";
import { calculatePhysicalEconomics } from "../lib/physicalEngine";
import { calculateScrubberValue } from "../lib/scrubberEngine";
import { number } from "../lib/format";
import { opportunitiesInMode } from "../lib/marketMode";
import { useLabStore } from "../store";
import { Panel } from "./common";

export function BasisWaterfall() {
  const state = useLabStore();
  const activeOpportunities = opportunitiesInMode(state.opportunities, state.routes, state.marketMode);
  const opportunity = activeOpportunities.find((item) => item.opportunity_id === state.selectedOpportunityId) ?? activeOpportunities[0];
  const vessel = state.vessels.find((item) => item.vessel_name === opportunity.vessel_name) ?? state.vessels[0];
  const route = state.routes.find((item) => item.route_code === opportunity.route_code) ?? state.routes[0];
  const bunker = state.bunkers[route.benchmark_family === "BLPG" ? 1 : 0];
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
  const rows = [
    { name: "Baltic TCE", value: physical.benchmarkTce },
    { name: "Fuel efficiency", value: (benchmark.laden_consumption - vessel.laden_consumption) * 155 },
    { name: "Scrubber", value: scrubber.scrubberValuePerDay },
    { name: "Speed", value: (vessel.laden_speed - benchmark.laden_speed) * 420 },
    { name: "Intake/cbm", value: (vessel.cbm - (benchmark.cbm ?? benchmark.grain_cbm ?? vessel.cbm)) * 0.04 },
    { name: "Position", value: 520 },
    { name: "Laycan", value: 280 },
    { name: "Hire premium", value: -Math.max(opportunity.tc_in_hire - physical.benchmarkTce, 0) },
    { name: "Costs", value: -physical.voyageCosts / Math.max(opportunity.voyage_days, 1) },
    { name: "Actual TCE", value: physical.actualTce },
  ];

  return (
    <Panel title="Basis Decomposition" description="Waterfall-style components behind actual expected TCE.">
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows}>
            <CartesianGrid stroke="#26313d" vertical={false} />
            <XAxis dataKey="name" stroke="#7b8794" tickLine={false} interval={0} angle={-24} textAnchor="end" height={72} />
            <YAxis stroke="#7b8794" tickFormatter={(value) => number(Number(value))} />
            <Tooltip contentStyle={{ background: "#111820", border: "1px solid #26313d", color: "#e8eef5" }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {rows.map((row) => (
                <Cell key={row.name} fill={row.value >= 0 ? "#5ec7a4" : "#e75f7f"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
