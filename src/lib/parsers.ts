import Papa from "papaparse";
import * as XLSX from "xlsx";
import { z } from "zod";
import type {
  BalticIndexRow,
  BunkerRow,
  FfaContractRow,
  PhysicalOpportunityRow,
  PublicationCalendarRow,
  RouteDistanceRow,
  VesselSpecRow,
} from "../types";

const numberish = z.coerce.number();
const boolish = z.union([z.boolean(), z.string(), z.number()]).transform((value) => {
  if (typeof value === "boolean") return value;
  return ["true", "yes", "1", "y"].includes(String(value).toLowerCase());
});

export const balticSchema = z.object({
  date: z.string(),
  index_code: z.string(),
  value: numberish,
  unit: z.enum(["$/day", "$/mt", "$/pt", "index"]),
});

export const ffaSchema = z.object({
  trade_date: z.string(),
  contract_code: z.string(),
  settlement_index: z.string(),
  period_type: z.enum(["MONTH", "QUARTER", "CALENDAR"]),
  period_start: z.string(),
  period_end: z.string(),
  price: numberish,
  bid: numberish,
  ask: numberish,
  unit: z.enum(["$/day", "$/mt", "$/pt", "index"]),
  lot_size: numberish,
  source: z.string(),
});

export const vesselSchema = z.object({
  vessel_name: z.string(),
  segment: z.enum(["PANAMAX", "VLGC"]),
  dwt: numberish,
  cbm: numberish,
  built_year: numberish,
  age: numberish,
  scrubber_fitted: boolish,
  loa: numberish,
  beam: numberish,
  draft: numberish,
  laden_speed: numberish,
  laden_consumption: numberish,
  ballast_speed: numberish,
  ballast_consumption: numberish,
  eco_laden_speed: numberish,
  eco_laden_consumption: numberish,
  eco_ballast_speed: numberish,
  eco_ballast_consumption: numberish,
  port_working_consumption: numberish,
  port_idle_consumption: numberish,
  fuel_type_main: z.enum(["VLSFO", "HSFO", "MGO", "MFO"]),
  fuel_type_scrubber: z.enum(["HSFO", "VLSFO", "MGO", "MFO"]),
  mgo_consumption: numberish,
  commercial_premium_or_discount: numberish,
});

export const opportunitySchema = z.object({
  opportunity_id: z.string(),
  vessel_name: z.string(),
  trade_type: z.enum(["TC_IN_ONLY", "TC_IN_AND_VOYAGE", "TC_IN_AND_TC_OUT", "CARGO_COVER", "COA_COVER", "VOYAGE_RELET"]),
  route_code: z.string(),
  delivery_area: z.string(),
  redelivery_area: z.string(),
  load_port: z.string(),
  discharge_port: z.string(),
  laycan_start: z.string(),
  laycan_end: z.string(),
  cargo_qty: numberish,
  freight_rate: numberish,
  tc_in_hire: numberish,
  tc_out_hire: numberish,
  voyage_days: numberish,
  ballast_days: numberish,
  laden_days: numberish,
  port_days: numberish,
  waiting_days: numberish,
  canal_days: numberish,
  commission_pct: numberish,
  port_costs: numberish,
  canal_costs: numberish,
  misc_costs: numberish,
  employment_status: z.enum(["FIXED", "OPEN", "INDICATED", "NONE"]),
});

export const bunkerSchema = z.object({
  date: z.string(),
  port: z.string(),
  VLSFO: numberish,
  HSFO: numberish,
  MGO: numberish,
  MFO: numberish,
  currency: z.string(),
});

export const routeSchema = z.object({
  route_code: z.string(),
  benchmark_family: z.enum(["PANAMAX", "BLPG"]),
  load_port: z.string(),
  discharge_port: z.string(),
  ballast_start: z.string(),
  laden_distance: numberish,
  ballast_distance: numberish,
  canal_required: boolish,
  standard_waiting_days: numberish,
  standard_load_days: numberish,
  standard_discharge_days: numberish,
  weather_margin: numberish,
  standard_commission: numberish,
  standard_cargo_qty: numberish.default(0),
  exposure: z.record(z.string(), numberish).default({}),
  route_notes: z.string().optional(),
});

export const publicationCalendarSchema = z.object({
  date: z.string(),
  is_published: boolish,
  is_holiday: boolish,
  notes: z.string().optional(),
});

type DatasetMap = {
  baltic: BalticIndexRow;
  ffa: FfaContractRow;
  vessel: VesselSpecRow;
  opportunity: PhysicalOpportunityRow;
  bunker: BunkerRow;
  route: RouteDistanceRow;
  calendar: PublicationCalendarRow;
};

const schemas = {
  baltic: balticSchema,
  ffa: ffaSchema,
  vessel: vesselSchema,
  opportunity: opportunitySchema,
  bunker: bunkerSchema,
  route: routeSchema,
  calendar: publicationCalendarSchema,
};

export async function parseUploadedFile<K extends keyof DatasetMap>(
  file: File,
  dataset: K,
  options?: { columnMap?: Record<string, string> },
): Promise<{
  rows: DatasetMap[K][];
  errors: string[];
  warnings: string[];
  columns: string[];
  previewRows: Record<string, unknown>[];
  rejectedRows: Array<{ rowNumber: number; row: Record<string, unknown>; errors: string[] }>;
  sourceMetadata: { fileName: string; sheetNames: string[]; rowCount: number; dataVersionId: string };
}> {
  const parsedFile = file.name.endsWith(".xlsx") || file.name.endsWith(".xls") ? await parseExcel(file) : { rows: await parseCsv(file), sheetNames: ["CSV"] };
  const normalizedRows = parsedFile.rows
    .map((row) => normalizeRow(row, options?.columnMap))
    .map((row) => normalizeAttachedWorkbookRow(row, dataset, file.name));
  const validRows: DatasetMap[K][] = [];
  const rejectedRows: Array<{ rowNumber: number; row: Record<string, unknown>; errors: string[] }> = [];
  normalizedRows.forEach((row, index) => {
    const parsed = schemas[dataset].safeParse(row);
    if (parsed.success) validRows.push(parsed.data as DatasetMap[K]);
    else {
      rejectedRows.push({
        rowNumber: index + 2,
        row,
        errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      });
    }
  });
  const warnings = rejectedRows.length ? [`${rejectedRows.length} rows rejected; valid rows can still be ingested.`] : [];
  return {
    rows: validRows,
    errors: validRows.length ? [] : rejectedRows.flatMap((row) => row.errors),
    warnings,
    rejectedRows,
    previewRows: normalizedRows.slice(0, 8),
    columns: Object.keys(normalizedRows[0] ?? {}),
    sourceMetadata: {
      fileName: file.name,
      sheetNames: parsedFile.sheetNames,
      rowCount: normalizedRows.length,
      dataVersionId: `${file.name}-${file.size}-${file.lastModified}`,
    },
  };
}

function normalizeAttachedWorkbookRow<K extends keyof DatasetMap>(
  row: Record<string, unknown>,
  dataset: K,
  fileName: string,
): Record<string, unknown> {
  if (dataset === "baltic" && row.date && row.value && !row.index_code) {
    const indexCode = inferPanamaxIndexCode(fileName);
    return {
      date: row.date,
      index_code: indexCode,
      value: row.value,
      unit: unitForPanamaxIndex(indexCode),
    };
  }

  if (dataset === "ffa" && row.route && row.period && row.value && row.date && !row.contract_code) {
    const inferred = inferForwardContract(fileName, String(row.route));
    const period = periodRange(String(row.period));
    const price = numericValue(row.value);
    return {
      trade_date: row.date,
      contract_code: inferred.contractCode,
      settlement_index: inferred.settlementIndex,
      period_type: period.periodType,
      period_start: period.start,
      period_end: period.end,
      price,
      bid: price,
      ask: price,
      unit: normalizeUnit(row.unit),
      lot_size: 1,
      source: `uploaded Panamax workbook: ${fileName}; single Value column supplied`,
    };
  }

  return row;
}

async function parseCsv(file: File): Promise<Record<string, unknown>[]> {
  const text = await file.text();
  const result = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
  return result.data;
}

async function parseExcel(file: File): Promise<{ rows: Record<string, unknown>[]; sheetNames: string[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const rows = workbook.SheetNames.flatMap((sheetName) =>
    XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName]).map((row) => ({ ...row, source_sheet: sheetName })),
  );
  return { rows, sheetNames: workbook.SheetNames };
}

function normalizeRow(row: Record<string, unknown>, columnMap?: Record<string, string>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  Object.entries(row).forEach(([rawKey, value]) => {
    const normalizedKey = normalizeColumnName(rawKey);
    const targetKey = columnMap?.[rawKey] ?? columnMap?.[normalizedKey] ?? normalizedKey;
    mapped[targetKey] = normalizeValue(value);
  });
  return mapped;
}

function normalizeColumnName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const trimmed = value.trim();
    const balticDate = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (balticDate) {
      return `${balticDate[3]}-${pad(monthNumber(balticDate[2]))}-${pad(Number(balticDate[1]))}`;
    }
    const date = Date.parse(trimmed);
    if (
      /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(trimmed) &&
      Number.isFinite(date)
    ) {
      return new Date(date).toISOString().slice(0, 10);
    }
    return trimmed;
  }
  return value;
}

function inferPanamaxIndexCode(fileName: string): string {
  const clean = fileName.replace(/\.[^.]+$/, "");
  const match = clean.match(/Panamax - ([A-Z0-9_]+(?:A_82)?)/i);
  if (match?.[1]) return match[1].toUpperCase().replace("P5TC", "P5TC");
  const ffadv = clean.match(/FFADV_([A-Z0-9]+)/i);
  if (ffadv?.[1]) return `FFADV_${ffadv[1].toUpperCase()}`;
  return clean.toUpperCase().replace(/[^A-Z0-9_]+/g, "_");
}

function unitForPanamaxIndex(indexCode: string): string {
  return ["P8", "P7", "P5_82"].includes(indexCode) ? "$/mt" : "$/day";
}

function inferForwardContract(fileName: string, route: string): { contractCode: string; settlementIndex: string } {
  const upperName = fileName.toUpperCase();
  const upperRoute = route.toUpperCase();
  if (upperName.includes("5TC") || upperRoute.includes("5TC")) return { contractCode: "P5TC-FFA", settlementIndex: "P5TC" };
  if (upperName.includes("P1EA_82") || upperRoute.includes("P1EA_82")) return { contractCode: "P1EA_82-FFA", settlementIndex: "P1A_82" };
  if (upperName.includes("P2EA_82") || upperRoute.includes("P2EA_82")) return { contractCode: "P2EA_82-FFA", settlementIndex: "P2A_82" };
  if (upperName.includes("P3EA_82") || upperRoute.includes("P3EA_82")) return { contractCode: "P3EA_82-FFA", settlementIndex: "P3A_82" };
  if (upperName.includes("P6") || upperRoute.includes("P6")) return { contractCode: "P6-FFA", settlementIndex: "P6_82" };
  return { contractCode: `${upperRoute.replace(/CURMON|\\+\\d+(MON|Q|CAL)|CURQ/g, "")}-FFA`, settlementIndex: upperRoute };
}

function periodRange(period: string): { periodType: "MONTH" | "QUARTER" | "CALENDAR"; start: string; end: string } {
  const monthMap: Record<string, number> = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
  };
  const month = period.match(/^([A-Z][a-z]{2}) (\d{2})$/);
  if (month) {
    const year = 2000 + Number(month[2]);
    const monthNumber = monthMap[month[1]];
    const endDay = new Date(year, monthNumber, 0).getDate();
    return {
      periodType: "MONTH",
      start: `${year}-${pad(monthNumber)}-01`,
      end: `${year}-${pad(monthNumber)}-${pad(endDay)}`,
    };
  }
  const quarter = period.match(/^Q([1-4]) (\d{2})$/);
  if (quarter) {
    const year = 2000 + Number(quarter[2]);
    const startMonth = (Number(quarter[1]) - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const endDay = new Date(year, endMonth, 0).getDate();
    return {
      periodType: "QUARTER",
      start: `${year}-${pad(startMonth)}-01`,
      end: `${year}-${pad(endMonth)}-${pad(endDay)}`,
    };
  }
  const calendar = period.match(/^Cal (\d{2})$/);
  if (calendar) {
    const year = 2000 + Number(calendar[1]);
    return { periodType: "CALENDAR", start: `${year}-01-01`, end: `${year}-12-31` };
  }
  return { periodType: "MONTH", start: "1970-01-01", end: "1970-01-31" };
}

function normalizeUnit(value: unknown): string {
  if (value === "$") return "$/day";
  return String(value ?? "$/day");
}

function numericValue(value: unknown): number {
  return typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthNumber(month: string): number {
  return {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
  }[month] ?? 1;
}
