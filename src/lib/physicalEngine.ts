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

  return {
    actualGrossRevenue: grossRevenue,
    fuelCost: actualFuelCost,
    voyageCosts,
    commission,
    actualTce,
    physicalEdge: actualTce - opportunity.tc_in_hire,
    benchmarkTce,
    benchmarkFreightPerMt: route.standard_cargo_qty ? benchmarkGross / route.standard_cargo_qty : 0,
    requiredFreightPerMt: opportunity.cargo_qty
      ? (opportunity.tc_in_hire * employmentDays + actualFuelCost + voyageCosts) / opportunity.cargo_qty
      : 0,
    shipSpecBasis: actualTce - benchmarkTce,
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
const round = (value: number) => Math.round(value * 100) / 100;
