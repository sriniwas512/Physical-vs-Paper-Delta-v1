import { addDays, format, isAfter, parseISO } from "date-fns";
import type { BacktestResult, BalticIndexRow, BunkerRow, FfaContractRow, PhysicalOpportunityRow, RouteDistanceRow, VesselSpecRow } from "../types";
import { calculateSettlement } from "./settlementEngine";
import { forwardContractRules } from "../rules/contractRegistry";
import { simulateHedge } from "./hedgeEngine";

export function runBacktest(input: {
  indexData: BalticIndexRow[];
  ffas: FfaContractRow[];
  bunkers: BunkerRow[];
  opportunity?: PhysicalOpportunityRow;
  vessel?: VesselSpecRow;
  route?: RouteDistanceRow;
  hedgeRatio: number;
}): BacktestResult {
  const missingFields = requiredMissing(input);
  if (missingFields.length) return insufficient(missingFields);

  const trades = input.ffas
    .filter((ffa) => forwardContractRules[ffa.contract_code])
    .sort((a, b) => a.trade_date.localeCompare(b.trade_date))
    .flatMap((ffa) => replayTrade(ffa, input.indexData, input.opportunity!, input.hedgeRatio));

  if (trades.length < 2) return insufficient(["historical FFA rows with final settlement observations"]);

  let cumulativePnl = 0;
  const equityCurve = trades.map((trade) => {
    cumulativePnl += trade.pnl;
    return { date: trade.date, pnl: trade.pnl, cumulativePnl };
  });
  const wins = trades.filter((trade) => trade.pnl > 0).length;
  const pnlValues = trades.map((trade) => trade.pnl);
  const avg = pnlValues.reduce((total, value) => total + value, 0) / pnlValues.length;
  const variance = pnlValues.reduce((total, value) => total + (value - avg) ** 2, 0) / pnlValues.length;
  const settlementForecastError = trades.reduce((total, trade) => total + Math.abs(trade.forecastError), 0) / trades.length;

  return {
    status: "OK",
    missingFields: [],
    equityCurve,
    historicalPnl: cumulativePnl,
    hitRate: wins / trades.length,
    maxDrawdown: calculateMaxDrawdown(equityCurve.map((row) => row.cumulativePnl)),
    sharpeLike: variance ? avg / Math.sqrt(variance) : 0,
    falseSignalCount: trades.filter((trade) => trade.entrySignal > 0 && trade.pnl <= 0).length,
    routeBasisLoss: trades.reduce((total, trade) => total + Math.min(0, trade.pnl), 0),
    scrubberAttribution: 0,
    settlementForecastError,
    formula: "Replay each uploaded FFA row as entry date, calculate expected settlement at entry, final settlement at expiry, execute at bid/ask, apply hedge ratio and lot rounding.",
  };
}

function replayTrade(ffa: FfaContractRow, indexData: BalticIndexRow[], opportunity: PhysicalOpportunityRow, hedgeRatio: number) {
  const rule = forwardContractRules[ffa.contract_code];
  if (!rule) return [];
  const entry = calculateSettlement(ffa, rule, indexData, { asOfDate: ffa.trade_date, forecastMode: "FLAT_FORWARD" });
  const finalAsOf = format(addDays(parseISO(ffa.period_end), 1), "yyyy-MM-dd");
  const final = calculateSettlement(ffa, rule, indexData, { asOfDate: finalAsOf, forecastMode: "FLAT_FORWARD" });
  if (!entry.observations.length || final.remainingDays > 0) return [];
  const hedge = simulateHedge({
    unit: rule.unit,
    side: entry.paperEdgeShort > entry.paperEdgeLong ? "SHORT" : "LONG",
    cargoQty: opportunity.cargo_qty,
    exposureDays: opportunity.voyage_days,
    hedgeRatio,
    entryPrice: ffa.price,
    settlementPrice: final.expectedSettlement,
    bid: ffa.bid,
    ask: ffa.ask,
    lotSize: ffa.lot_size,
  });
  return [{ date: ffa.trade_date, pnl: hedge.paperPnl - hedge.transactionCosts, forecastError: final.expectedSettlement - entry.expectedSettlement, entrySignal: Math.max(entry.paperEdgeShort, entry.paperEdgeLong) }];
}

function requiredMissing(input: Parameters<typeof runBacktest>[0]): string[] {
  const missing: string[] = [];
  if (input.indexData.length < 10) missing.push("historical Baltic index data");
  if (input.ffas.length < 2) missing.push("historical FFA/futures data");
  if (!input.bunkers.length) missing.push("historical bunker data");
  if (!input.opportunity) missing.push("physical opportunity assumptions");
  if (!input.vessel) missing.push("vessel specification");
  if (!input.route) missing.push("route assumptions");
  return missing;
}

function insufficient(missingFields: string[]): BacktestResult {
  return {
    status: "INSUFFICIENT_DATA",
    missingFields,
    equityCurve: [],
    historicalPnl: 0,
    hitRate: 0,
    maxDrawdown: 0,
    sharpeLike: 0,
    falseSignalCount: 0,
    routeBasisLoss: 0,
    scrubberAttribution: 0,
    settlementForecastError: 0,
    formula: "Backtest refused to generate metrics because required historical data is missing.",
  };
}

function calculateMaxDrawdown(values: number[]): number {
  let peak = values[0] ?? 0;
  let maxDrawdown = 0;
  values.forEach((value) => {
    if (isAfter(new Date(), new Date(0))) peak = Math.max(peak, value);
    maxDrawdown = Math.max(maxDrawdown, peak - value);
  });
  return maxDrawdown;
}

