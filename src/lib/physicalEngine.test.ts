import { describe, expect, it } from "vitest";
import { benchmarkShips, bunkers, opportunities, routes, vessels } from "../data/mockData";
import { calculatePhysicalEconomics } from "./physicalEngine";

describe("physicalEngine", () => {
  it("calculates voyage TCE and required freight transparently", () => {
    const opportunity = opportunities[0];
    const vessel = vessels[0];
    const route = routes.find((item) => item.route_code === opportunity.route_code)!;
    const result = calculatePhysicalEconomics({
      opportunity,
      vessel,
      route,
      bunker: bunkers[0],
      benchmarkShip: benchmarkShips.BPI82_STANDARD_SHIP,
    });

    expect(result.actualGrossRevenue).toBeGreaterThan(0);
    expect(result.fuelCost).toBeGreaterThan(0);
    expect(result.actualTce).toBeGreaterThan(0);
    expect(result.requiredFreightPerMt).toBeGreaterThan(0);
    expect(result.componentPnl.bunkerCost).toBeLessThan(0);
  });

  it("warns when TC-in only has no employment plan", () => {
    const opportunity = { ...opportunities[0], trade_type: "TC_IN_ONLY" as const, employment_status: "NONE" as const };
    const route = routes.find((item) => item.route_code === opportunity.route_code)!;
    const result = calculatePhysicalEconomics({
      opportunity,
      vessel: vessels[0],
      route,
      bunker: bunkers[0],
      benchmarkShip: benchmarkShips.BPI82_STANDARD_SHIP,
    });

    expect(result.warnings.join(" ")).toContain("NO_EMPLOYMENT_PLAN");
  });
});

