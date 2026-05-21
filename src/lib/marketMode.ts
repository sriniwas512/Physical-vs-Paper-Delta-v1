import type { BenchmarkFamily, FfaContractRow, PhysicalOpportunityRow, RouteDistanceRow } from "../types";

export const defaultOpportunityByMode: Record<BenchmarkFamily, string> = {
  PANAMAX: "",
  BLPG: "",
};

export const defaultContractByMode: Record<BenchmarkFamily, string> = {
  PANAMAX: "P6-FFA",
  BLPG: "",
};

export function isFfaInMode(ffa: FfaContractRow, mode: BenchmarkFamily): boolean {
  const code = `${ffa.contract_code} ${ffa.settlement_index}`.toUpperCase();
  return mode === "BLPG" ? code.includes("BLPG") : !code.includes("BLPG");
}

export function routesInMode(routes: RouteDistanceRow[], mode: BenchmarkFamily): RouteDistanceRow[] {
  return routes.filter((route) => route.benchmark_family === mode);
}

export function opportunitiesInMode(
  opportunities: PhysicalOpportunityRow[],
  routes: RouteDistanceRow[],
  mode: BenchmarkFamily,
): PhysicalOpportunityRow[] {
  const activeRouteCodes = new Set(routesInMode(routes, mode).map((route) => route.route_code));
  return opportunities.filter((opportunity) => activeRouteCodes.has(opportunity.route_code));
}
