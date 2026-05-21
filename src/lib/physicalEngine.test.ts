import { describe, expect, it } from "vitest";
import { benchmarkShips } from "../data/panamaxSeedData";
import { bunkerFixture, opportunityFixture, routeFixture, vesselFixture } from "./testFixtures";
import { calculatePhysicalEconomics } from "./physicalEngine";

describe("physicalEngine", () => {
  it("calculates voyage TCE and required freight transparently", () => {
    const result = calculatePhysicalEconomics({
      opportunity: opportunityFixture,
      vessel: vesselFixture,
      route: routeFixture,
      bunker: bunkerFixture,
      benchmarkShip: benchmarkShips.BPI82_STANDARD_SHIP,
    });

    expect(result.actualGrossRevenue).toBeGreaterThan(0);
    expect(result.fuelCost).toBeGreaterThan(0);
    expect(result.actualTce).toBeGreaterThan(0);
    expect(result.requiredFreightPerMt).toBeGreaterThan(0);
    expect(result.componentPnl.bunkerCost).toBeLessThan(0);
  });

  it("warns when TC-in only has no employment plan", () => {
    const opportunity = { ...opportunityFixture, trade_type: "TC_IN_ONLY" as const, employment_status: "NONE" as const };
    const result = calculatePhysicalEconomics({
      opportunity,
      vessel: vesselFixture,
      route: routeFixture,
      bunker: bunkerFixture,
      benchmarkShip: benchmarkShips.BPI82_STANDARD_SHIP,
    });

    expect(result.warnings.join(" ")).toContain("NO_EMPLOYMENT_PLAN");
  });
});
