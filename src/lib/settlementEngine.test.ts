import { describe, expect, it } from "vitest";
import { addDays, format } from "date-fns";
import type { BalticIndexRow, FfaContractRow } from "../types";
import {
  calculateSettlement,
  settlementRules,
} from "./settlementEngine";

const prints = (indexCode: string, start: string, values: number[]): BalticIndexRow[] =>
  values.map((value, offset) => ({
    date: format(addDays(new Date(`${start}T00:00:00Z`), offset), "yyyy-MM-dd"),
    index_code: indexCode,
    value,
    unit: "$/day",
  }));

const contract: FfaContractRow = {
  trade_date: "2026-05-12",
  contract_code: "P5TC-FFA",
  settlement_index: "P5TC",
  period_type: "MONTH",
  period_start: "2026-05-01",
  period_end: "2026-05-31",
  price: 13000,
  bid: 12900,
  ask: 13100,
  unit: "$/day",
  lot_size: 1,
  source: "mock",
};

describe("settlementEngine", () => {
  it("averages all monthly published days and separates realized from remaining", () => {
    const result = calculateSettlement(
      contract,
      settlementRules["P5TC-FFA"],
      prints("P5TC", "2026-05-01", [10000, 11000, 12000, 13000]),
      { asOfDate: "2026-05-02", forecastMode: "FLAT_FORWARD" },
    );

    expect(result.realizedDays).toBe(2);
    expect(result.remainingDays).toBe(2);
    expect(result.expectedSettlement).toBe(10750);
    expect(result.paperEdgeShort).toBe(2250);
    expect(result.impliedRemaining).toBe(15500);
  });

  it("uses only the last seven published days for route last-seven contracts", () => {
    const result = calculateSettlement(
      { ...contract, contract_code: "P1A_82-FFA", settlement_index: "P1A_82" },
      settlementRules["P1A_82-FFA"],
      prints("P1A_82", "2026-05-01", [1, 2, 3, 4, 5, 6, 7, 8, 9]),
      { asOfDate: "2026-05-07", forecastMode: "FLAT_FORWARD" },
    );

    expect(result.observations.map((row) => row.value)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(result.realizedDays).toBe(5);
    expect(result.remainingDays).toBe(2);
  });
});
