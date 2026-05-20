import { addDays, format, isAfter, isSameMonth, isWeekend, isWithinInterval, parseISO } from "date-fns";
import type {
  BalticIndexRow,
  BalticPublicationCalendar,
  FfaContractRow,
  ForecastMode,
  SettlementResult,
  SettlementRule,
} from "../types";
import { allContractRules as settlementRules } from "../rules/contractRegistry";
import { headlineIndices } from "../rules/indexRegistry";

export { settlementRules };

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
    rounding: headlineIndices.BPI.rounding,
    componentFormula: headlineIndices.BPI.componentFormula,
    multiplier: headlineIndices.BPI.multiplier,
    formula: `BPI = ${headlineIndices.BPI.formula}`,
  },
  BLPG: {
    label: "Baltic LPG Index",
    unit: "index" as const,
    rounding: headlineIndices.BLPG.rounding,
    componentFormula: headlineIndices.BLPG.componentFormula,
    multiplier: headlineIndices.BLPG.multiplier,
    formula: `BLPG = ${headlineIndices.BLPG.formula}`,
  },
};

export function getSettlementObservationSet(
  contract: FfaContractRow,
  rule: SettlementRule,
  indexData: BalticIndexRow[],
  calendar?: BalticPublicationCalendar,
): BalticIndexRow[] {
  if (rule.discontinued) return [];
  const periodStart = parseISO(contract.period_start);
  const periodEnd = parseISO(contract.period_end);
  const validPublishedDates = new Set(expectedPublicationDates(periodStart, periodEnd, calendar));
  const sourceRows = deriveSeries(rule, indexData).filter((row) => {
    const date = parseISO(row.date);
    if (rule.usesPublishedDaysOnly && !validPublishedDates.has(row.date)) return false;
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
  options: { asOfDate: string; forecastMode: ForecastMode; userForecast?: BalticIndexRow[]; calendar?: BalticPublicationCalendar },
): SettlementResult {
  const observations = getSettlementObservationSet(contract, rule, indexData, options.calendar);
  const expectedDates = expectedPublicationDates(parseISO(contract.period_start), parseISO(contract.period_end), options.calendar);
  const asOf = parseISO(options.asOfDate);
  const realized = observations.filter((row) => !isAfter(parseISO(row.date), asOf));
  const remaining = observations.filter((row) => isAfter(parseISO(row.date), asOf));
  const missingObservationDates = expectedDates.filter((date) => !observations.some((row) => row.date === date));
  const realizedSum = sum(realized.map((row) => row.value));
  const forecastValues = forecastRemaining(observations, realized, remaining, options);
  const expectedSettlement = observations.length
    ? (realizedSum + sum(forecastValues)) / observations.length
    : 0;
  const impliedRemaining = remaining.length
    ? (contract.price * observations.length - realizedSum) / remaining.length
    : undefined;

  const warnings = dataQualityWarnings(contract, rule, observations, missingObservationDates);
  return {
    contractCode: contract.contract_code,
    rule,
    observations,
    realized,
    remaining,
    missingObservationDates,
    realizedDays: realized.length,
    remainingDays: remaining.length,
    expectedSettlement,
    impliedRemaining,
    paperEdgeShort: contract.price - expectedSettlement,
    paperEdgeLong: expectedSettlement - contract.price,
    formula: `${rule.settlementBasis}: (realized ${realized.length} prints + ${options.forecastMode.toLowerCase().replace("_", " ")} forecast ${remaining.length} prints) / ${observations.length}. Short edge = FFA ${contract.price} - expected settlement ${round(expectedSettlement)} ${rule.unit}.`,
    asOfDate: options.asOfDate,
    ruleVersion: `${rule.gmbVersion ?? "Unversioned"} / ${rule.sourceReference ?? "No source reference"}`,
    dataQualityWarnings: warnings,
    restatementHandling: "Placeholder: re-run settlement with restated Baltic rows and preserve prior audit snapshot.",
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
    return typeof value === "number" ? [{ date, index_code: rule.settlementIndex, value, unit: rule.unit }] : [];
  });
}

export function expectedPublicationDates(start: Date, end: Date, calendar?: BalticPublicationCalendar): string[] {
  if (calendar?.publishedDates.length) {
    return calendar.publishedDates.filter((date) => isWithinInterval(parseISO(date), { start, end }));
  }
  const holidays = new Set(calendar?.holidays ?? []);
  const dates: string[] = [];
  for (let cursor = start; !isAfter(cursor, end); cursor = addDays(cursor, 1)) {
    const iso = format(cursor, "yyyy-MM-dd");
    if (!isWeekend(cursor) && !holidays.has(iso)) dates.push(iso);
  }
  return dates;
}

function dataQualityWarnings(
  contract: FfaContractRow,
  rule: SettlementRule,
  observations: BalticIndexRow[],
  missingObservationDates: string[],
): string[] {
  const warnings: string[] = [];
  if (rule.discontinued) warnings.push(`${rule.contractCode} is discontinued under ${rule.gmbVersion}; reject new hedge signals.`);
  if (!observations.length) warnings.push("MISSING_SETTLEMENT_DAYS: no Baltic prints available for this rule and contract period.");
  if (missingObservationDates.length) warnings.push(`MISSING_SETTLEMENT_DAYS: ${missingObservationDates.length} expected publishing days have no uploaded print.`);
  if (contract.unit !== rule.unit) warnings.push(`UNIT_MISMATCH: uploaded ${contract.unit} but GMB rule requires ${rule.unit}.`);
  return warnings;
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
