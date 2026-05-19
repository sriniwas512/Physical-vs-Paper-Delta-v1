import { isAfter, isSameMonth, isWithinInterval, parseISO } from "date-fns";
import type {
  BalticIndexRow,
  FfaContractRow,
  ForecastMode,
  SettlementResult,
  SettlementRule,
} from "../types";

const baseRule = (
  contractCode: string,
  settlementIndex: string,
  unit: SettlementRule["unit"],
  settlementBasis: SettlementRule["settlementBasis"],
  options?: Partial<SettlementRule>,
): SettlementRule => ({
  contractCode,
  settlementIndex,
  unit,
  settlementBasis,
  sourceSeries: settlementIndex,
  periodType: "MONTH",
  usesPublishedDaysOnly: true,
  missingDataPolicy: "ERROR",
  ...options,
});

export const settlementRules: Record<string, SettlementRule> = {
  "P5TC-FFA": baseRule("P5TC-FFA", "P5TC", "$/day", "MONTH_AVERAGE"),
  "P6-FFA": baseRule("P6-FFA", "P6_82", "$/day", "MONTH_AVERAGE"),
  "P8-FFA": baseRule("P8-FFA", "P8", "$/day", "MONTH_AVERAGE"),
  "P1A_03-FFA": baseRule("P1A_03-FFA", "P1A_03", "$/pt", "MONTH_AVERAGE", {
    sourceSeries: "P1A_82",
    derivedAdjustment: -1284,
  }),
  "P2A_03-FFA": baseRule("P2A_03-FFA", "P2A_03", "$/pt", "MONTH_AVERAGE", {
    sourceSeries: "P2A_82",
    derivedAdjustment: -1489,
  }),
  "P3A_03-FFA": baseRule("P3A_03-FFA", "P3A_03", "$/pt", "MONTH_AVERAGE", {
    sourceSeries: "P3A_82",
    derivedAdjustment: -1302,
  }),
  "P1EA_03-FFA": baseRule("P1EA_03-FFA", "P1A_03", "$/pt", "LAST_7_PUBLISHED_DAYS", {
    sourceSeries: "P1A_82",
    derivedAdjustment: -1284,
  }),
  "P2EA_03-FFA": baseRule("P2EA_03-FFA", "P2A_03", "$/pt", "LAST_7_PUBLISHED_DAYS", {
    sourceSeries: "P2A_82",
    derivedAdjustment: -1489,
  }),
  "P3EA_03-FFA": baseRule("P3EA_03-FFA", "P3A_03", "$/pt", "LAST_7_PUBLISHED_DAYS", {
    sourceSeries: "P3A_82",
    derivedAdjustment: -1302,
  }),
  "P1A_82-FFA": baseRule("P1A_82-FFA", "P1A_82", "$/day", "LAST_7_PUBLISHED_DAYS"),
  "P2A_82-FFA": baseRule("P2A_82-FFA", "P2A_82", "$/day", "LAST_7_PUBLISHED_DAYS"),
  "P3A_82-FFA": baseRule("P3A_82-FFA", "P3A_82", "$/day", "LAST_7_PUBLISHED_DAYS"),
  "P1EA_82-FFA": baseRule("P1EA_82-FFA", "P1A_82", "$/day", "MONTH_AVERAGE"),
  "P2EA_82-FFA": baseRule("P2EA_82-FFA", "P2A_82", "$/day", "MONTH_AVERAGE"),
  "P3EA_82-FFA": baseRule("P3EA_82-FFA", "P3A_82", "$/day", "MONTH_AVERAGE"),
  "BLPG1-FFA": baseRule("BLPG1-FFA", "BLPG1", "$/mt", "MONTH_AVERAGE"),
  "BLPG2-FFA": baseRule("BLPG2-FFA", "BLPG2", "$/mt", "MONTH_AVERAGE"),
  "BLPG3-FFA": baseRule("BLPG3-FFA", "BLPG3", "$/mt", "MONTH_AVERAGE"),
};

export const p5tcFormula = [
  { indexCode: "P1A_82", weight: 0.25 },
  { indexCode: "P2A_82", weight: 0.1 },
  { indexCode: "P3A_82", weight: 0.25 },
  { indexCode: "P4_82", weight: 0.1 },
  { indexCode: "P6_82", weight: 0.3 },
];

export const balticHeadlineRules = {
  BPI: {
    label: "Baltic Panamax Index",
    unit: "index" as const,
    rounding: "RoundedSum",
    componentFormula: p5tcFormula,
    multiplier: 0.111111,
    formula:
      "BPI = RoundedSum(P1A_82*0.25, P2A_82*0.1, P3A_82*0.25, P4_82*0.10, P6_82*0.30)*0.111111",
  },
  BLPG: {
    label: "Baltic LPG Index",
    unit: "index" as const,
    rounding: "RoundedAverage",
    componentFormula: [
      { indexCode: "BLPG1-TCE", weight: 1 / 3 },
      { indexCode: "BLPG2-TCE", weight: 1 / 3 },
      { indexCode: "BLPG3-TCE", weight: 1 / 3 },
    ],
    multiplier: 0.1,
    formula: "BLPG = RoundedAverage(BLPG1-TCE, BLPG2-TCE, BLPG3-TCE)*0.1",
  },
};

export function getSettlementObservationSet(
  contract: FfaContractRow,
  rule: SettlementRule,
  indexData: BalticIndexRow[],
): BalticIndexRow[] {
  const periodStart = parseISO(contract.period_start);
  const periodEnd = parseISO(contract.period_end);
  const sourceRows = deriveSeries(rule, indexData).filter((row) => {
    const date = parseISO(row.date);
    if (rule.settlementBasis === "CALENDAR_AVERAGE") {
      return date.getFullYear() === periodStart.getFullYear();
    }
    if (rule.settlementBasis === "QUARTER_AVERAGE") {
      return isWithinInterval(date, { start: periodStart, end: periodEnd });
    }
    return isSameMonth(date, periodStart) && isWithinInterval(date, { start: periodStart, end: periodEnd });
  });

  const sorted = sourceRows.sort((a, b) => a.date.localeCompare(b.date));
  if (rule.settlementBasis === "LAST_7_PUBLISHED_DAYS") {
    return sorted.slice(-7);
  }
  return sorted;
}

export function calculateSettlement(
  contract: FfaContractRow,
  rule: SettlementRule,
  indexData: BalticIndexRow[],
  options: { asOfDate: string; forecastMode: ForecastMode; userForecast?: BalticIndexRow[] },
): SettlementResult {
  const observations = getSettlementObservationSet(contract, rule, indexData);
  const asOf = parseISO(options.asOfDate);
  const realized = observations.filter((row) => !isAfter(parseISO(row.date), asOf));
  const remaining = observations.filter((row) => isAfter(parseISO(row.date), asOf));
  const realizedSum = sum(realized.map((row) => row.value));
  const forecastValues = forecastRemaining(observations, realized, remaining, options);
  const expectedSettlement = observations.length
    ? (realizedSum + sum(forecastValues)) / observations.length
    : 0;
  const impliedRemaining = remaining.length
    ? (contract.price * observations.length - realizedSum) / remaining.length
    : undefined;

  return {
    contractCode: contract.contract_code,
    rule,
    observations,
    realized,
    remaining,
    realizedDays: realized.length,
    remainingDays: remaining.length,
    expectedSettlement,
    impliedRemaining,
    paperEdgeShort: contract.price - expectedSettlement,
    paperEdgeLong: expectedSettlement - contract.price,
    formula: `${rule.settlementBasis}: (realized ${realized.length} prints + ${options.forecastMode.toLowerCase().replace("_", " ")} forecast ${remaining.length} prints) / ${observations.length}. Short edge = FFA ${contract.price} - expected settlement ${round(expectedSettlement)} ${rule.unit}.`,
  };
}

function deriveSeries(rule: SettlementRule, indexData: BalticIndexRow[]): BalticIndexRow[] {
  if (rule.settlementBasis !== "CUSTOM_BASKET" || !rule.componentFormula?.length) {
    return indexData
      .filter((row) => row.index_code === rule.settlementIndex || row.index_code === rule.sourceSeries)
      .map((row) =>
        row.index_code === rule.sourceSeries && rule.derivedAdjustment
          ? { ...row, index_code: rule.settlementIndex, unit: rule.unit, value: row.value + rule.derivedAdjustment }
          : row,
      );
  }

  const byDate = new Map<string, BalticIndexRow[]>();
  indexData.forEach((row) => {
    byDate.set(row.date, [...(byDate.get(row.date) ?? []), row]);
  });

  return [...byDate.entries()].flatMap(([date, rows]) => {
    const value = rule.componentFormula?.reduce((total, component) => {
      const row = rows.find((candidate) => candidate.index_code === component.indexCode);
      return row ? total + row.value * component.weight : total;
    }, 0);
    return value ? [{ date, index_code: rule.settlementIndex, value, unit: rule.unit }] : [];
  });
}

function forecastRemaining(
  observations: BalticIndexRow[],
  realized: BalticIndexRow[],
  remaining: BalticIndexRow[],
  options: { forecastMode: ForecastMode; userForecast?: BalticIndexRow[] },
): number[] {
  if (!remaining.length) return [];
  if (options.forecastMode === "USER_FORECAST" && options.userForecast?.length) {
    return remaining.map((row) => options.userForecast?.find((forecast) => forecast.date === row.date)?.value ?? latest(realized, observations));
  }
  if (options.forecastMode === "STATISTICAL") {
    const history = realized.length ? realized : observations;
    const trailing = history.slice(-10);
    const average = sum(trailing.map((row) => row.value)) / Math.max(trailing.length, 1);
    return remaining.map(() => average);
  }
  return remaining.map(() => latest(realized, observations));
}

const latest = (realized: BalticIndexRow[], observations: BalticIndexRow[]) =>
  (realized.at(-1) ?? observations.at(-1))?.value ?? 0;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const round = (value: number) => Math.round(value * 100) / 100;
