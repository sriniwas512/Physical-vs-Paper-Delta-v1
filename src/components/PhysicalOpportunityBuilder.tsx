import { useState } from "react";
import { calculatePhysicalEconomics } from "../lib/physicalEngine";
import { calculateScrubberValue } from "../lib/scrubberEngine";
import { benchmarkShips } from "../data/panamaxSeedData";
import { money, rate } from "../lib/format";
import { opportunitiesInMode } from "../lib/marketMode";
import { useLabStore } from "../store";
import type { BunkerRow, PhysicalOpportunityRow, RouteDistanceRow, VesselSpecRow } from "../types";
import { Field, Metric, Panel, Tag } from "./common";

type Draft = {
  opportunity: PhysicalOpportunityRow;
  vessel: VesselSpecRow;
  route: RouteDistanceRow;
  bunker: BunkerRow;
  routeExposureText: string;
};

export function PhysicalOpportunityBuilder() {
  const state = useLabStore();
  const activeOpportunities = opportunitiesInMode(state.opportunities, state.routes, state.marketMode);
  const selectedOpportunity = activeOpportunities.find((item) => item.opportunity_id === state.selectedOpportunityId);
  const [draft, setDraft] = useState(() => buildDraft(state.marketMode, selectedOpportunity, state));

  const benchmark = benchmarkShips[draft.route.benchmark_family === "BLPG" ? "VLGC84_STANDARD_SHIP" : "BPI82_STANDARD_SHIP"];
  const physical = calculatePhysicalEconomics({
    opportunity: draft.opportunity,
    vessel: draft.vessel,
    route: draft.route,
    bunker: draft.bunker,
    benchmarkShip: benchmark,
  });
  const scrubber = calculateScrubberValue({
    vessel: draft.vessel,
    opportunity: draft.opportunity,
    mode: state.scrubberMode,
    ownerSharePct: 50,
    hsfoPrice: draft.bunker.HSFO,
    vlsfoPrice: draft.bunker.VLSFO,
    eligibleScrubberSeaDays: draft.opportunity.laden_days + draft.opportunity.ballast_days,
    eligibleScrubberLadenDays: draft.opportunity.laden_days,
    eligibleScrubberBallastDays: draft.opportunity.ballast_days,
    scrubberOffDays: 1,
    extraScrubberOpexPerDay: 650,
    washwaterRestrictionAdjustment: 12000,
  });

  const saveDraft = () => {
    const exposure = parseExposure(draft.routeExposureText);
    const opportunity = { ...draft.opportunity, route_exposure: exposure };
    const route = { ...draft.route, exposure };
    state.ingest("vessels", upsertBy(state.vessels, draft.vessel, "vessel_name"));
    state.ingest("routes", upsertBy(state.routes, route, "route_code"));
    state.ingest("bunkers", upsertBunker(state.bunkers, draft.bunker));
    state.ingest("opportunities", upsertBy(state.opportunities, opportunity, "opportunity_id"));
    state.setSelectedOpportunityId(opportunity.opportunity_id);
  };

  return (
    <Panel title="Physical Opportunity Builder" description="Manual deal ticket for the real ship leg. Enter the physical opportunity, vessel, route, bunker and scrubber assumptions directly.">
      <div className="toolbar">
        <Field label="Existing opportunity">
          <select
            value={state.selectedOpportunityId}
            onChange={(event) => {
              const nextId = event.target.value;
              const nextOpportunity = activeOpportunities.find((item) => item.opportunity_id === nextId);
              state.setSelectedOpportunityId(nextId);
              setDraft(buildDraft(state.marketMode, nextOpportunity, state));
            }}
          >
            <option value="">New opportunity</option>
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
        <button onClick={saveDraft}>Save physical opportunity</button>
      </div>

      <div className="manual-builder-grid">
        <Section title="Opportunity">
          <TextField label="Opportunity ID" value={draft.opportunity.opportunity_id} onChange={(value) => updateOpportunity(setDraft, { opportunity_id: value })} />
          <TextField label="Vessel name" value={draft.opportunity.vessel_name} onChange={(value) => updateBothVesselNames(setDraft, value)} />
          <SelectField label="Trade type" value={draft.opportunity.trade_type} options={["TC_IN_ONLY", "TC_IN_AND_VOYAGE", "TC_IN_AND_TC_OUT", "CARGO_COVER", "COA_COVER", "VOYAGE_RELET"]} onChange={(value) => updateOpportunity(setDraft, { trade_type: value as PhysicalOpportunityRow["trade_type"] })} />
          <TextField label="Route code" value={draft.opportunity.route_code} onChange={(value) => updateBothRouteCodes(setDraft, value)} />
          <TextField label="Delivery area" value={draft.opportunity.delivery_area} onChange={(value) => updateOpportunity(setDraft, { delivery_area: value })} />
          <TextField label="Redelivery area" value={draft.opportunity.redelivery_area} onChange={(value) => updateOpportunity(setDraft, { redelivery_area: value })} />
          <TextField label="Load port" value={draft.opportunity.load_port} onChange={(value) => updateLoadPort(setDraft, value)} />
          <TextField label="Discharge port" value={draft.opportunity.discharge_port} onChange={(value) => updateDischargePort(setDraft, value)} />
          <TextField label="Laycan start" type="date" value={draft.opportunity.laycan_start} onChange={(value) => updateOpportunity(setDraft, { laycan_start: value })} />
          <TextField label="Laycan end" type="date" value={draft.opportunity.laycan_end} onChange={(value) => updateOpportunity(setDraft, { laycan_end: value })} />
          <NumberField label="Cargo qty mt" value={draft.opportunity.cargo_qty} onChange={(value) => updateOpportunity(setDraft, { cargo_qty: value })} />
          <NumberField label="Freight rate $/mt" value={draft.opportunity.freight_rate} onChange={(value) => updateOpportunity(setDraft, { freight_rate: value })} />
          <NumberField label="TC-in hire $/day" value={draft.opportunity.tc_in_hire} onChange={(value) => updateOpportunity(setDraft, { tc_in_hire: value })} />
          <NumberField label="TC-out hire $/day" value={draft.opportunity.tc_out_hire} onChange={(value) => updateOpportunity(setDraft, { tc_out_hire: value })} />
          <NumberField label="Internal freight value" value={draft.opportunity.internal_freight_value ?? 0} onChange={(value) => updateOpportunity(setDraft, { internal_freight_value: value })} />
          <SelectField label="Employment status" value={draft.opportunity.employment_status} options={["FIXED", "OPEN", "INDICATED", "NONE"]} onChange={(value) => updateOpportunity(setDraft, { employment_status: value as PhysicalOpportunityRow["employment_status"] })} />
        </Section>

        <Section title="Voyage Days And Costs">
          <NumberField label="Total voyage days" value={draft.opportunity.voyage_days} onChange={(value) => updateOpportunity(setDraft, { voyage_days: value })} />
          <NumberField label="Ballast days" value={draft.opportunity.ballast_days} onChange={(value) => updateOpportunity(setDraft, { ballast_days: value })} />
          <NumberField label="Laden days" value={draft.opportunity.laden_days} onChange={(value) => updateOpportunity(setDraft, { laden_days: value })} />
          <NumberField label="Port days" value={draft.opportunity.port_days} onChange={(value) => updateOpportunity(setDraft, { port_days: value })} />
          <NumberField label="Waiting days" value={draft.opportunity.waiting_days} onChange={(value) => updateOpportunity(setDraft, { waiting_days: value })} />
          <NumberField label="Canal days" value={draft.opportunity.canal_days} onChange={(value) => updateOpportunity(setDraft, { canal_days: value })} />
          <NumberField label="Commission %" value={draft.opportunity.commission_pct} onChange={(value) => updateOpportunity(setDraft, { commission_pct: value })} />
          <NumberField label="Port costs $" value={draft.opportunity.port_costs} onChange={(value) => updateOpportunity(setDraft, { port_costs: value })} />
          <NumberField label="Canal costs $" value={draft.opportunity.canal_costs} onChange={(value) => updateOpportunity(setDraft, { canal_costs: value })} />
          <NumberField label="Misc costs $" value={draft.opportunity.misc_costs} onChange={(value) => updateOpportunity(setDraft, { misc_costs: value })} />
        </Section>

        <Section title="Vessel Specification">
          <SelectField label="Segment" value={draft.vessel.segment} options={["PANAMAX", "VLGC"]} onChange={(value) => updateVessel(setDraft, { segment: value as VesselSpecRow["segment"] })} />
          <NumberField label="DWT" value={draft.vessel.dwt} onChange={(value) => updateVessel(setDraft, { dwt: value })} />
          <NumberField label="CBM" value={draft.vessel.cbm} onChange={(value) => updateVessel(setDraft, { cbm: value })} />
          <NumberField label="Built year" value={draft.vessel.built_year} onChange={(value) => updateVessel(setDraft, { built_year: value })} />
          <NumberField label="Age" value={draft.vessel.age} onChange={(value) => updateVessel(setDraft, { age: value })} />
          <SelectField label="Scrubber fitted" value={String(draft.vessel.scrubber_fitted)} options={["false", "true"]} onChange={(value) => updateVessel(setDraft, { scrubber_fitted: value === "true" })} />
          <NumberField label="LOA" value={draft.vessel.loa} onChange={(value) => updateVessel(setDraft, { loa: value })} />
          <NumberField label="Beam" value={draft.vessel.beam} onChange={(value) => updateVessel(setDraft, { beam: value })} />
          <NumberField label="Draft" value={draft.vessel.draft} onChange={(value) => updateVessel(setDraft, { draft: value })} />
          <NumberField label="Laden speed" value={draft.vessel.laden_speed} onChange={(value) => updateVessel(setDraft, { laden_speed: value })} />
          <NumberField label="Laden consumption" value={draft.vessel.laden_consumption} onChange={(value) => updateVessel(setDraft, { laden_consumption: value })} />
          <NumberField label="Ballast speed" value={draft.vessel.ballast_speed} onChange={(value) => updateVessel(setDraft, { ballast_speed: value })} />
          <NumberField label="Ballast consumption" value={draft.vessel.ballast_consumption} onChange={(value) => updateVessel(setDraft, { ballast_consumption: value })} />
          <NumberField label="Eco laden speed" value={draft.vessel.eco_laden_speed} onChange={(value) => updateVessel(setDraft, { eco_laden_speed: value })} />
          <NumberField label="Eco laden consumption" value={draft.vessel.eco_laden_consumption} onChange={(value) => updateVessel(setDraft, { eco_laden_consumption: value })} />
          <NumberField label="Eco ballast speed" value={draft.vessel.eco_ballast_speed} onChange={(value) => updateVessel(setDraft, { eco_ballast_speed: value })} />
          <NumberField label="Eco ballast consumption" value={draft.vessel.eco_ballast_consumption} onChange={(value) => updateVessel(setDraft, { eco_ballast_consumption: value })} />
          <NumberField label="Port working consumption" value={draft.vessel.port_working_consumption} onChange={(value) => updateVessel(setDraft, { port_working_consumption: value })} />
          <NumberField label="Port idle consumption" value={draft.vessel.port_idle_consumption} onChange={(value) => updateVessel(setDraft, { port_idle_consumption: value })} />
          <SelectField label="Main fuel" value={draft.vessel.fuel_type_main} options={["VLSFO", "HSFO", "MGO", "MFO"]} onChange={(value) => updateVessel(setDraft, { fuel_type_main: value as VesselSpecRow["fuel_type_main"] })} />
          <SelectField label="Scrubber fuel" value={draft.vessel.fuel_type_scrubber} options={["HSFO", "VLSFO", "MGO", "MFO"]} onChange={(value) => updateVessel(setDraft, { fuel_type_scrubber: value as VesselSpecRow["fuel_type_scrubber"] })} />
          <NumberField label="MGO consumption" value={draft.vessel.mgo_consumption} onChange={(value) => updateVessel(setDraft, { mgo_consumption: value })} />
          <NumberField label="Commercial premium/discount $/day" value={draft.vessel.commercial_premium_or_discount} onChange={(value) => updateVessel(setDraft, { commercial_premium_or_discount: value })} />
        </Section>

        <Section title="Route, Bunkers And Exposure">
          <SelectField label="Benchmark family" value={draft.route.benchmark_family} options={["PANAMAX", "BLPG"]} onChange={(value) => updateRoute(setDraft, { benchmark_family: value as RouteDistanceRow["benchmark_family"] })} />
          <TextField label="Ballast start" value={draft.route.ballast_start} onChange={(value) => updateRoute(setDraft, { ballast_start: value })} />
          <NumberField label="Laden distance nm" value={draft.route.laden_distance} onChange={(value) => updateRoute(setDraft, { laden_distance: value })} />
          <NumberField label="Ballast distance nm" value={draft.route.ballast_distance} onChange={(value) => updateRoute(setDraft, { ballast_distance: value })} />
          <SelectField label="Canal required" value={String(draft.route.canal_required)} options={["false", "true"]} onChange={(value) => updateRoute(setDraft, { canal_required: value === "true" })} />
          <NumberField label="Standard waiting days" value={draft.route.standard_waiting_days} onChange={(value) => updateRoute(setDraft, { standard_waiting_days: value })} />
          <NumberField label="Standard load days" value={draft.route.standard_load_days} onChange={(value) => updateRoute(setDraft, { standard_load_days: value })} />
          <NumberField label="Standard discharge days" value={draft.route.standard_discharge_days} onChange={(value) => updateRoute(setDraft, { standard_discharge_days: value })} />
          <NumberField label="Weather margin" value={draft.route.weather_margin} step="0.01" onChange={(value) => updateRoute(setDraft, { weather_margin: value })} />
          <NumberField label="Standard commission %" value={draft.route.standard_commission} onChange={(value) => updateRoute(setDraft, { standard_commission: value })} />
          <NumberField label="Standard cargo qty" value={draft.route.standard_cargo_qty} onChange={(value) => updateRoute(setDraft, { standard_cargo_qty: value })} />
          <TextField label="Bunker port" value={draft.bunker.port} onChange={(value) => updateBunker(setDraft, { port: value })} />
          <TextField label="Bunker date" type="date" value={draft.bunker.date} onChange={(value) => updateBunker(setDraft, { date: value })} />
          <NumberField label="VLSFO $/mt" value={draft.bunker.VLSFO} onChange={(value) => updateBunker(setDraft, { VLSFO: value })} />
          <NumberField label="HSFO $/mt" value={draft.bunker.HSFO} onChange={(value) => updateBunker(setDraft, { HSFO: value })} />
          <NumberField label="MGO $/mt" value={draft.bunker.MGO} onChange={(value) => updateBunker(setDraft, { MGO: value })} />
          <NumberField label="MFO $/mt" value={draft.bunker.MFO} onChange={(value) => updateBunker(setDraft, { MFO: value })} />
          <TextField label="Route exposure JSON" value={draft.routeExposureText} onChange={(value) => setDraft((current) => ({ ...current, routeExposureText: value }))} />
        </Section>
      </div>

      <div className="metric-grid four builder-results">
        <Metric label="Actual TCE" value={rate(physical.actualTce, "$/day")} tone={physical.actualTce > 0 ? "good" : "warn"} formula={physical.formula} />
        <Metric label="Benchmark TCE" value={rate(physical.benchmarkTce, "$/day")} formula={physical.formula} />
        <Metric label="Ship basis" value={rate(physical.shipSpecBasis, "$/day")} tone={physical.shipSpecBasis > 0 ? "good" : "bad"} formula="Actual TCE - Baltic equivalent TCE." />
        <Metric label="Required freight" value={rate(physical.requiredFreightPerMt, "$/mt")} formula="(TC-in hire x voyage days + fuel + voyage costs) / cargo quantity." />
      </div>

      <div className="economics-strip">
        <Tag>Gross revenue {money(physical.actualGrossRevenue)}</Tag>
        <Tag>Fuel {money(physical.fuelCost)}</Tag>
        <Tag>Costs {money(physical.voyageCosts)}</Tag>
        <Tag>Scrubber {rate(scrubber.scrubberValuePerDay, "$/day")}</Tag>
      </div>
      <div className="registry-rules">
        <div><b>PnL by component</b><span>{Object.entries(physical.componentPnl).map(([key, value]) => `${key}: ${money(value)}`).join(" · ")}</span></div>
        <div><b>Sensitivity</b><span>{physical.sensitivity.map((item) => `${item.label}: ${money(item.value, item.unit)}`).join(" · ")}</span></div>
        <div><b>Warnings</b><span>{[...physical.warnings, ...(scrubber.warning ? [scrubber.warning] : [])].join(" · ") || "CLEAR"}</span></div>
      </div>
    </Panel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="manual-section">
      <h3>{title}</h3>
      <div className="manual-fields">{children}</div>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <Field label={label}>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function NumberField({ label, value, onChange, step = "1" }: { label: string; value: number; onChange: (value: number) => void; step?: string }) {
  return (
    <Field label={label}>
      <input type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />
    </Field>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </Field>
  );
}

function buildDraft(marketMode: "PANAMAX" | "BLPG", opportunity: PhysicalOpportunityRow | undefined, state: ReturnType<typeof useLabStore.getState>): Draft {
  const baseOpportunity = opportunity ?? blankOpportunity(marketMode);
  const vessel = state.vessels.find((item) => item.vessel_name === baseOpportunity.vessel_name) ?? blankVessel(marketMode, baseOpportunity.vessel_name);
  const route = state.routes.find((item) => item.route_code === baseOpportunity.route_code) ?? blankRoute(marketMode, baseOpportunity.route_code);
  const bunker = state.bunkers.find((item) => item.port === (route.benchmark_family === "BLPG" ? "Houston" : "Singapore")) ?? blankBunker(route.benchmark_family === "BLPG" ? "Houston" : "Singapore");
  return {
    opportunity: baseOpportunity,
    vessel,
    route: { ...route, load_port: baseOpportunity.load_port, discharge_port: baseOpportunity.discharge_port },
    bunker,
    routeExposureText: JSON.stringify(route.exposure ?? baseOpportunity.route_exposure ?? defaultExposure(marketMode)),
  };
}

function blankOpportunity(marketMode: "PANAMAX" | "BLPG"): PhysicalOpportunityRow {
  const isPanamax = marketMode === "PANAMAX";
  return {
    opportunity_id: isPanamax ? "PAN-MANUAL-001" : "LPG-MANUAL-001",
    vessel_name: isPanamax ? "Manual Panamax Vessel" : "Manual VLGC Vessel",
    trade_type: "TC_IN_AND_VOYAGE",
    route_code: isPanamax ? "MANUAL_PANAMAX_ROUTE" : "MANUAL_BLPG_ROUTE",
    delivery_area: "",
    redelivery_area: "",
    load_port: "",
    discharge_port: "",
    laycan_start: new Date().toISOString().slice(0, 10),
    laycan_end: new Date().toISOString().slice(0, 10),
    cargo_qty: isPanamax ? 76000 : 44000,
    freight_rate: 0,
    tc_in_hire: 0,
    tc_out_hire: 0,
    voyage_days: 0,
    ballast_days: 0,
    laden_days: 0,
    port_days: 0,
    waiting_days: 0,
    canal_days: 0,
    commission_pct: isPanamax ? 5 : 1.25,
    port_costs: 0,
    canal_costs: 0,
    misc_costs: 0,
    employment_status: "OPEN",
    internal_freight_value: 0,
    route_exposure: defaultExposure(marketMode),
  };
}

function blankVessel(marketMode: "PANAMAX" | "BLPG", vesselName: string): VesselSpecRow {
  const ship = benchmarkShips[marketMode === "BLPG" ? "VLGC84_STANDARD_SHIP" : "BPI82_STANDARD_SHIP"];
  return {
    vessel_name: vesselName,
    segment: marketMode === "BLPG" ? "VLGC" : "PANAMAX",
    dwt: ship.dwt,
    cbm: ship.cbm ?? ship.grain_cbm ?? 0,
    built_year: new Date().getFullYear(),
    age: 0,
    scrubber_fitted: false,
    loa: ship.loa ?? 0,
    beam: ship.beam ?? 0,
    draft: ship.draft ?? 0,
    laden_speed: ship.laden_speed,
    laden_consumption: ship.laden_consumption,
    ballast_speed: ship.ballast_speed,
    ballast_consumption: ship.ballast_consumption,
    eco_laden_speed: ship.eco_laden_speed,
    eco_laden_consumption: ship.eco_laden_consumption,
    eco_ballast_speed: ship.eco_ballast_speed,
    eco_ballast_consumption: ship.eco_ballast_consumption,
    port_working_consumption: ship.port_working_consumption,
    port_idle_consumption: ship.port_idle_consumption,
    fuel_type_main: "VLSFO",
    fuel_type_scrubber: "HSFO",
    mgo_consumption: ship.mgo_at_sea ?? 0,
    commercial_premium_or_discount: 0,
  };
}

function blankRoute(marketMode: "PANAMAX" | "BLPG", routeCode: string): RouteDistanceRow {
  return {
    route_code: routeCode,
    benchmark_family: marketMode,
    load_port: "",
    discharge_port: "",
    ballast_start: "",
    laden_distance: 0,
    ballast_distance: 0,
    canal_required: false,
    standard_waiting_days: 0,
    standard_load_days: 0,
    standard_discharge_days: 0,
    weather_margin: 0,
    standard_commission: marketMode === "PANAMAX" ? 5 : 1.25,
    standard_cargo_qty: marketMode === "PANAMAX" ? 76000 : 44000,
    exposure: defaultExposure(marketMode),
    route_notes: "Manual physical opportunity route.",
  };
}

function blankBunker(port: string): BunkerRow {
  return {
    date: new Date().toISOString().slice(0, 10),
    port,
    VLSFO: 0,
    HSFO: 0,
    MGO: 0,
    MFO: 0,
    currency: "USD",
  };
}

function defaultExposure(marketMode: "PANAMAX" | "BLPG"): Record<string, number> {
  return marketMode === "PANAMAX" ? { P6_82: 1 } : { BLPG3: 1 };
}

function updateOpportunity(setDraft: React.Dispatch<React.SetStateAction<Draft>>, patch: Partial<PhysicalOpportunityRow>) {
  setDraft((current) => ({ ...current, opportunity: { ...current.opportunity, ...patch } }));
}

function updateVessel(setDraft: React.Dispatch<React.SetStateAction<Draft>>, patch: Partial<VesselSpecRow>) {
  setDraft((current) => ({ ...current, vessel: { ...current.vessel, ...patch } }));
}

function updateRoute(setDraft: React.Dispatch<React.SetStateAction<Draft>>, patch: Partial<RouteDistanceRow>) {
  setDraft((current) => ({ ...current, route: { ...current.route, ...patch } }));
}

function updateBunker(setDraft: React.Dispatch<React.SetStateAction<Draft>>, patch: Partial<BunkerRow>) {
  setDraft((current) => ({ ...current, bunker: { ...current.bunker, ...patch } }));
}

function updateBothVesselNames(setDraft: React.Dispatch<React.SetStateAction<Draft>>, vesselName: string) {
  setDraft((current) => ({
    ...current,
    opportunity: { ...current.opportunity, vessel_name: vesselName },
    vessel: { ...current.vessel, vessel_name: vesselName },
  }));
}

function updateBothRouteCodes(setDraft: React.Dispatch<React.SetStateAction<Draft>>, routeCode: string) {
  setDraft((current) => ({
    ...current,
    opportunity: { ...current.opportunity, route_code: routeCode },
    route: { ...current.route, route_code: routeCode },
  }));
}

function updateLoadPort(setDraft: React.Dispatch<React.SetStateAction<Draft>>, loadPort: string) {
  setDraft((current) => ({
    ...current,
    opportunity: { ...current.opportunity, load_port: loadPort },
    route: { ...current.route, load_port: loadPort },
  }));
}

function updateDischargePort(setDraft: React.Dispatch<React.SetStateAction<Draft>>, dischargePort: string) {
  setDraft((current) => ({
    ...current,
    opportunity: { ...current.opportunity, discharge_port: dischargePort },
    route: { ...current.route, discharge_port: dischargePort },
  }));
}

function parseExposure(value: string): Record<string, number> {
  try {
    const parsed = JSON.parse(value) as Record<string, number>;
    return Object.fromEntries(Object.entries(parsed).map(([key, exposure]) => [key, Number(exposure)]));
  } catch {
    return {};
  }
}

function upsertBy<T extends Record<K, string>, K extends keyof T>(rows: T[], row: T, key: K): T[] {
  const exists = rows.some((item) => item[key] === row[key]);
  return exists ? rows.map((item) => (item[key] === row[key] ? row : item)) : [...rows, row];
}

function upsertBunker(rows: BunkerRow[], row: BunkerRow): BunkerRow[] {
  const exists = rows.some((item) => item.port === row.port && item.date === row.date);
  return exists ? rows.map((item) => (item.port === row.port && item.date === row.date ? row : item)) : [...rows, row];
}
