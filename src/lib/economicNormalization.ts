import type { NormalizedPaperEdge, PaperSide, Unit } from "../types";

export function normalizePaperEdge(input: {
  unit: Unit;
  side: PaperSide;
  entryPrice: number;
  expectedSettlement: number;
  cargoQty?: number;
  exposureDays?: number;
  hedgeRatio: number;
  pointValueUsd?: number;
}): NormalizedPaperEdge {
  const nativeEdge =
    input.side === "SHORT"
      ? input.entryPrice - input.expectedSettlement
      : input.expectedSettlement - input.entryPrice;
  const exposureDays = Math.max(input.exposureDays ?? 0, 0);
  const warnings: string[] = [];

  if (input.unit === "$/mt") {
    if (!input.cargoQty) warnings.push("UNIT_MISMATCH: $/mt paper requires cargo tonnes for USD normalization.");
    const notional = (input.cargoQty ?? 0) * input.hedgeRatio;
    const usdTotal = nativeEdge * notional;
    return {
      nativeEdge,
      nativeUnit: input.unit,
      usdTotal,
      usdPerDayEq: exposureDays ? usdTotal / exposureDays : 0,
      notional,
      notionalUnit: "mt",
      formula: `$/mt paper normalization = native edge ${round(nativeEdge)} $/mt x ${round(notional)} mt; per-day equivalent divides by ${round(exposureDays)} exposure days.`,
      warnings,
    };
  }

  if (input.unit === "$/day") {
    const notional = exposureDays * input.hedgeRatio;
    const usdTotal = nativeEdge * notional;
    return {
      nativeEdge,
      nativeUnit: input.unit,
      usdTotal,
      usdPerDayEq: exposureDays ? usdTotal / exposureDays : 0,
      notional,
      notionalUnit: "days",
      formula: `$/day paper normalization = native edge ${round(nativeEdge)} $/day x ${round(notional)} exposure days.`,
      warnings,
    };
  }

  if (input.unit === "$/pt" || input.unit === "index") {
    if (!input.pointValueUsd) warnings.push("UNIT_MISMATCH: point/index paper requires explicit pointValueUsd.");
    const notional = exposureDays * input.hedgeRatio;
    const usdTotal = nativeEdge * notional * (input.pointValueUsd ?? 0);
    return {
      nativeEdge,
      nativeUnit: input.unit,
      usdTotal,
      usdPerDayEq: exposureDays ? usdTotal / exposureDays : 0,
      notional,
      notionalUnit: "points",
      formula: `${input.unit} paper normalization = native edge ${round(nativeEdge)} x ${round(notional)} exposure units x point value ${input.pointValueUsd ?? 0}.`,
      warnings,
    };
  }

  return {
    nativeEdge,
    nativeUnit: input.unit,
    usdTotal: 0,
    usdPerDayEq: 0,
    notional: 0,
    notionalUnit: "days",
    formula: "Unsupported unit normalization.",
    warnings: ["UNIT_MISMATCH: unsupported paper unit."],
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

