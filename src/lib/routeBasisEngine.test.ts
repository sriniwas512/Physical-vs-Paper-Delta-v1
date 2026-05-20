import { describe, expect, it } from "vitest";
import type { BalticIndexRow } from "../types";
import { calculateRouteBasis } from "./routeBasisEngine";

const rows: BalticIndexRow[] = Array.from({ length: 12 }, (_, index) => {
  const day = String(index + 1).padStart(2, "0");
  return [
    { date: `2026-05-${day}`, index_code: "P6_82", value: 15000 + index * 100, unit: "$/day" as const },
    { date: `2026-05-${day}`, index_code: "P5TC", value: 14000 + index * 80, unit: "$/day" as const },
    { date: `2026-05-${day}`, index_code: "BLPG3", value: 120 + index, unit: "$/mt" as const },
    { date: `2026-05-${day}`, index_code: "BLPG", value: 115 + index * 0.8, unit: "index" as const },
  ];
}).flat();

describe("routeBasisEngine", () => {
  it("calculates P6 versus P5TC spread, beta and z-score", () => {
    const result = calculateRouteBasis({ indexData: rows, physicalExposure: { P6_82: 1 }, hedgeIndex: "P5TC" });

    expect(result.spread).toBeGreaterThan(0);
    expect(result.beta).toBeGreaterThan(0);
    expect(Number.isFinite(result.zScore)).toBe(true);
    expect(result.warning).toBe("ROUTE_MISMATCH");
  });

  it("calculates BLPG3 versus BLPG composite spread", () => {
    const result = calculateRouteBasis({ indexData: rows, physicalExposure: { BLPG3: 1 }, hedgeIndex: "BLPG" });

    expect(result.physicalIndex).toBe("BLPG3");
    expect(result.hedgeIndex).toBe("BLPG");
    expect(result.observations).toBe(12);
  });
});

