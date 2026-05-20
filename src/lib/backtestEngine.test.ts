import { describe, expect, it } from "vitest";
import { addDays, format } from "date-fns";
import { bunkers, ffaContracts, opportunities, routes, vessels } from "../data/mockData";
import type { BalticIndexRow } from "../types";
import { runBacktest } from "./backtestEngine";

const historicalPrints: BalticIndexRow[] = Array.from({ length: 25 }, (_, index) => ({
  date: format(addDays(new Date("2026-05-01T00:00:00Z"), index), "yyyy-MM-dd"),
  index_code: "P6_82",
  value: 15000 + index * 25,
  unit: "$/day" as const,
}));

describe("backtestEngine", () => {
  it("refuses to show fake metrics when required data is missing", () => {
    const result = runBacktest({ indexData: [], ffas: [], bunkers: [], hedgeRatio: 1 });

    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.equityCurve).toEqual([]);
    expect(result.missingFields).toContain("historical Baltic index data");
  });

  it("replays paper PnL from uploaded historical rows", () => {
    const result = runBacktest({
      indexData: historicalPrints,
      ffas: [ffaContracts.find((ffa) => ffa.contract_code === "P6-FFA")!, { ...ffaContracts.find((ffa) => ffa.contract_code === "P6-FFA")!, trade_date: "2026-05-19", price: 15200 }],
      bunkers,
      opportunity: opportunities[0],
      vessel: vessels[0],
      route: routes.find((route) => route.route_code === opportunities[0].route_code),
      hedgeRatio: 1,
    });

    expect(result.status).toBe("OK");
    expect(result.equityCurve.length).toBeGreaterThan(0);
    expect(Number.isFinite(result.maxDrawdown)).toBe(true);
  });
});

