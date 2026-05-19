import type { HedgeResult, PaperSide, Unit } from "../types";

export function sizeHedgeNotional(input: {
  unit: Unit;
  exposureDays?: number;
  cargoQty?: number;
  hedgeRatio: number;
}): { notional: number; unit: "days" | "mt"; warning?: string } {
  if (input.unit === "$/mt") {
    if (!input.cargoQty) {
      return {
        notional: 0,
        unit: "mt",
        warning: "Cannot size BLPG paper hedge properly without cargo quantity or voyage employment assumption.",
      };
    }
    return { notional: input.cargoQty * input.hedgeRatio, unit: "mt" };
  }
  return { notional: (input.exposureDays ?? 0) * input.hedgeRatio, unit: "days" };
}

export function calculatePaperPnl(input: {
  side: PaperSide;
  notional: number;
  entryPrice: number;
  settlementPrice: number;
}): number {
  const direction = input.side === "SHORT" ? 1 : -1;
  return input.notional * (input.entryPrice - input.settlementPrice) * direction;
}

export function simulateHedge(input: {
  unit: Unit;
  side: PaperSide;
  cargoQty?: number;
  exposureDays?: number;
  hedgeRatio: number;
  entryPrice: number;
  settlementPrice: number;
}): HedgeResult {
  const sized = sizeHedgeNotional(input);
  const paperPnl = calculatePaperPnl({
    side: input.side,
    notional: sized.notional,
    entryPrice: input.entryPrice,
    settlementPrice: input.settlementPrice,
  });
  return {
    notional: sized.notional,
    notionalUnit: sized.unit,
    paperPnl,
    warning: sized.warning,
    formula: `${input.side} paper PnL = ${round(sized.notional)} ${sized.unit} x (${input.entryPrice} entry - ${round(input.settlementPrice)} settlement). ${input.unit === "$/mt" ? "BLPG paper uses cargo tonnes, not vessel days." : "Day-rate paper uses exposure days."}`,
  };
}

const round = (value: number) => Math.round(value * 100) / 100;
