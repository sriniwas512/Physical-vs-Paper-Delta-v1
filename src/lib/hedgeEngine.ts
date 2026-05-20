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
  bid?: number;
  ask?: number;
  lotSize?: number;
  minTradeSize?: number;
  slippage?: number;
  marginRate?: number;
}): HedgeResult {
  const sized = sizeHedgeNotional(input);
  const lotSize = input.lotSize && input.lotSize > 0 ? input.lotSize : 1;
  const roundedLots = Math.round(sized.notional / lotSize);
  const roundedNotional = roundedLots * lotSize;
  const executionPrice = executionPriceFor(input);
  const paperPnl = calculatePaperPnl({
    side: input.side,
    notional: roundedNotional,
    entryPrice: executionPrice,
    settlementPrice: input.settlementPrice,
  });
  const transactionCosts = Math.abs(roundedNotional) * Math.max(input.slippage ?? 0, 0);
  const marginRequirement = Math.abs(roundedNotional * executionPrice * (input.marginRate ?? 0.08));
  const residualExposure = sized.notional - roundedNotional;
  const warnings = [
    ...(sized.warning ? [sized.warning] : []),
    ...(input.minTradeSize && Math.abs(roundedNotional) < input.minTradeSize ? [`MIN_TRADE_SIZE: rounded hedge ${round(roundedNotional)} is below minimum ${input.minTradeSize}.`] : []),
    ...(Math.abs(residualExposure) > 0.01 ? [`PARTIAL_LOT: ${round(residualExposure)} ${sized.unit} residual after lot rounding.`] : []),
    ...(input.unit === "$/mt" && !input.cargoQty ? ["UNIT_MISMATCH: $/mt paper requires cargo tonnes, not exposure days."] : []),
  ];
  return {
    notional: sized.notional,
    notionalUnit: sized.unit,
    roundedLots,
    roundedNotional,
    executionPrice,
    transactionCosts,
    marginRequirement,
    residualExposure,
    effectivenessScore: sized.notional ? Math.max(0, Math.min(100, 100 - (Math.abs(residualExposure) / Math.abs(sized.notional)) * 100)) : 0,
    paperPnl,
    warning: sized.warning,
    warnings,
    formula: `${input.side} paper PnL = ${round(roundedNotional)} ${sized.unit} x (${round(executionPrice)} execution - ${round(input.settlementPrice)} settlement). ${input.unit === "$/mt" ? "BLPG paper uses cargo tonnes, not vessel days." : "Day-rate paper uses exposure days."} Lot size ${lotSize}; residual ${round(residualExposure)} ${sized.unit}.`,
  };
}

function executionPriceFor(input: { side: PaperSide; entryPrice: number; bid?: number; ask?: number; slippage?: number }): number {
  const base = input.side === "SHORT" ? input.bid ?? input.entryPrice : input.ask ?? input.entryPrice;
  return input.side === "SHORT" ? base - (input.slippage ?? 0) : base + (input.slippage ?? 0);
}

const round = (value: number) => Math.round(value * 100) / 100;
