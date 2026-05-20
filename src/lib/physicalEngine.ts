import type {
  BenchmarkShip,
  BunkerRow,
  PhysicalOpportunityRow,
  PhysicalResult,
  RouteDistanceRow,
  VesselSpecRow,
} from "../types";

export function calculatePhysicalEconomics(input: {
  opportunity: PhysicalOpportunityRow;
  vessel: VesselSpecRow;
  bunker: BunkerRow;
  route: RouteDistanceRow;
  benchmarkShip: BenchmarkShip;
  asOfDate?: string;
}): PhysicalResult {
  const { opportunity, vessel, bunker, route, benchmarkShip } = input;
  const employmentDays = opportunity.voyage_days || totalDays(opportunity);
  const grossRevenue = grossRevenueFor(opportunity, employmentDays);
  const actualFuelCost =
    opportunity.laden_days * vessel.laden_consumption * bunker[vessel.fuel_type_main] +
    opportunity.ballast_days * vessel.ballast_consumption * bunker[vessel.fuel_type_main] +
    opportunity.port_days * vessel.port_working_consumption * bunker[vessel.fuel_type_main] +
    opportunity.waiting_days * vessel.port_idle_consumption * bunker[vessel.fuel_type_main];
  const commission = grossRevenue * (opportunity.commission_pct / 100);
  const voyageCosts = opportunity.port_costs + opportunity.canal_costs + opportunity.misc_costs + commission;
  const actualTce = employmentDays ? (grossRevenue - actualFuelCost - voyageCosts) / employmentDays : 0;

  const benchmarkDays = benchmarkVoyageDays(route, benchmarkShip);
  const benchmarkFuelCost =
    (route.laden_distance / Math.max(benchmarkShip.laden_speed * 24, 1)) *
      benchmarkShip.laden_consumption *
      bunker.VLSFO *
      (1 + route.weather_margin) +
    (route.ballast_distance / Math.max(benchmarkShip.ballast_speed * 24, 1)) *
      benchmarkShip.ballast_consumption *
      bunker.VLSFO *
      (1 + route.weather_margin) +
    (route.standard_load_days + route.standard_discharge_days) * benchmarkShip.port_working_consumption * bunker.VLSFO +
    route.standard_waiting_days * benchmarkShip.port_idle_consumption * bunker.VLSFO;
  const benchmarkGross = opportunity.freight_rate * (route.standard_cargo_qty || opportunity.cargo_qty);
  const benchmarkCommission = benchmarkGross * (route.standard_commission / 100);
  const benchmarkVoyageCosts = opportunity.port_costs + opportunity.canal_costs + benchmarkCommission;
  const benchmarkTce = benchmarkDays ? (benchmarkGross - benchmarkFuelCost - benchmarkVoyageCosts) / benchmarkDays : 0;
  const requiredFreightPerMt = opportunity.cargo_qty
    ? (opportunity.tc_in_hire * employmentDays + actualFuelCost + voyageCosts) / opportunity.cargo_qty
    : 0;
  const requiredTcOut = employmentDays
    ? (opportunity.tc_in_hire * employmentDays + actualFuelCost + voyageCosts) / employmentDays
    : 0;
  const warnings = physicalWarnings(opportunity, vessel, route, benchmarkShip);

  return {
    actualGrossRevenue: grossRevenue,
    fuelCost: actualFuelCost,
    voyageCosts,
    commission,
    actualTce,
    physicalEdge: actualTce - opportunity.tc_in_hire,
    benchmarkTce,
    benchmarkFreightPerMt: route.standard_cargo_qty ? benchmarkGross / route.standard_cargo_qty : 0,
    requiredFreightPerMt,
    requiredTcOut,
    shipSpecBasis: actualTce - benchmarkTce,
    componentPnl: {
      grossRevenue,
      bunkerCost: -actualFuelCost,
      voyageCosts: -voyageCosts,
      hireCost: -opportunity.tc_in_hire * employmentDays,
      shipSpecBasis: (actualTce - benchmarkTce) * employmentDays,
    },
    warnings,
    sensitivity: [
      { label: "HSFO/VLSFO +25 $/mt", value: fuelSensitivity(opportunity, vessel, 25) / Math.max(employmentDays, 1), unit: "$/day" },
      { label: "Canal delay +1 day", value: -opportunity.tc_in_hire, unit: "$" },
      { label: "Port DA +10%", value: -(opportunity.port_costs * 0.1), unit: "$" },
    ],
    formula: `Actual TCE = (gross revenue ${round(grossRevenue)} - fuel ${round(actualFuelCost)} - costs ${round(voyageCosts)}) / ${round(employmentDays)} days. Benchmark TCE uses ${benchmarkShip.code} speed/consumption, route distance, standard port/waiting days and commission.`,
  };
}

export function grossRevenueFor(opportunity: PhysicalOpportunityRow, employmentDays: number): number {
  if (["TC_IN_AND_TC_OUT", "VOYAGE_RELET"].includes(opportunity.trade_type)) {
    return opportunity.tc_out_hire * employmentDays;
  }
  if (opportunity.trade_type === "COA_COVER") {
    return opportunity.cargo_qty * (opportunity.internal_freight_value ?? opportunity.freight_rate);
  }
  if (["TC_IN_AND_VOYAGE", "CARGO_COVER"].includes(opportunity.trade_type)) {
    return opportunity.cargo_qty * opportunity.freight_rate;
  }
  return 0;
}

export function benchmarkVoyageDays(route: RouteDistanceRow, ship: BenchmarkShip): number {
  const seaDays =
    route.laden_distance / Math.max(ship.laden_speed * 24, 1) +
    route.ballast_distance / Math.max(ship.ballast_speed * 24, 1);
  return seaDays * (1 + route.weather_margin) + route.standard_waiting_days + route.standard_load_days + route.standard_discharge_days;
}

const totalDays = (opportunity: PhysicalOpportunityRow) =>
  opportunity.laden_days + opportunity.ballast_days + opportunity.port_days + opportunity.waiting_days + opportunity.canal_days;
const physicalWarnings = (
  opportunity: PhysicalOpportunityRow,
  vessel: VesselSpecRow,
  route: RouteDistanceRow,
  benchmarkShip: BenchmarkShip,
) => {
  const warnings: string[] = [];
  if (opportunity.trade_type === "TC_IN_ONLY" && opportunity.employment_status === "NONE") {
    warnings.push("NO_EMPLOYMENT_PLAN: TC-in ship has no cargo, TC-out, COA or voyage relet plan.");
  }
  if (vessel.age > (benchmarkShip.max_age ?? 99)) warnings.push("AGE_COMPLIANCE: real vessel age exceeds benchmark max age assumption.");
  if (route.standard_cargo_qty && Math.abs(opportunity.cargo_qty - route.standard_cargo_qty) / route.standard_cargo_qty > 0.05) {
    warnings.push("CARGO_QTY_TOLERANCE: cargo quantity differs by more than 5% from the benchmark route size.");
  }
  const laycanStart = Date.parse(opportunity.laycan_start);
  const laycanEnd = Date.parse(opportunity.laycan_end);
  if (Number.isFinite(laycanStart) && Number.isFinite(laycanEnd) && laycanStart > laycanEnd) warnings.push("LAYCAN_COMPLIANCE: laycan start is after laycan end.");
  if (route.canal_required && opportunity.canal_days <= 0) warnings.push("CANAL_DELAY: route requires canal transit but opportunity has no canal days.");
  if (!opportunity.port_costs) warnings.push("PORT_DA_UNCERTAINTY: port costs are missing or zero.");
  warnings.push("DEMURRAGE_DESPATCH_PLACEHOLDER: not yet valued; review charterparty terms.");
  warnings.push("OFF_HIRE_PLACEHOLDER: not yet valued; review off-hire and performance risk.");
  return warnings;
};

const fuelSensitivity = (opportunity: PhysicalOpportunityRow, vessel: VesselSpecRow, priceMove: number) =>
  -priceMove *
  (opportunity.laden_days * vessel.laden_consumption +
    opportunity.ballast_days * vessel.ballast_consumption +
    opportunity.port_days * vessel.port_working_consumption +
    opportunity.waiting_days * vessel.port_idle_consumption);
const round = (value: number) => Math.round(value * 100) / 100;
