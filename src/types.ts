export type Unit = "$/day" | "$/mt" | "$/pt" | "index";
export type Segment = "PANAMAX" | "VLGC";
export type BenchmarkFamily = "PANAMAX" | "BLPG";
export type TradeType =
  | "TC_IN_ONLY"
  | "TC_IN_AND_VOYAGE"
  | "TC_IN_AND_TC_OUT"
  | "CARGO_COVER"
  | "COA_COVER"
  | "VOYAGE_RELET";

export type SettlementBasis =
  | "MONTH_AVERAGE"
  | "LAST_7_PUBLISHED_DAYS"
  | "QUARTER_AVERAGE"
  | "CALENDAR_AVERAGE"
  | "CUSTOM_BASKET";

export type PeriodType = "MONTH" | "QUARTER" | "CALENDAR";
export type ForecastMode = "FLAT_FORWARD" | "USER_FORECAST" | "STATISTICAL";
export type PaperSide = "LONG" | "SHORT";
export type ScrubberCaptureMode =
  | "CHARTERER_RETAINS"
  | "OWNER_RETAINS"
  | "SHARED"
  | "TC_OUT_MARKET_PREMIUM_ONLY";

export type BalticIndexRow = {
  date: string;
  index_code: string;
  value: number;
  unit: Unit;
};

export type FfaContractRow = {
  trade_date: string;
  contract_code: string;
  settlement_index: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  price: number;
  bid: number;
  ask: number;
  unit: Unit;
  lot_size: number;
  source: string;
};

export type VesselSpecRow = {
  vessel_name: string;
  segment: Segment;
  dwt: number;
  cbm: number;
  built_year: number;
  age: number;
  scrubber_fitted: boolean;
  loa: number;
  beam: number;
  draft: number;
  laden_speed: number;
  laden_consumption: number;
  ballast_speed: number;
  ballast_consumption: number;
  eco_laden_speed: number;
  eco_laden_consumption: number;
  eco_ballast_speed: number;
  eco_ballast_consumption: number;
  port_working_consumption: number;
  port_idle_consumption: number;
  fuel_type_main: "VLSFO" | "HSFO" | "MGO" | "MFO";
  fuel_type_scrubber: "HSFO" | "VLSFO" | "MGO" | "MFO";
  mgo_consumption: number;
  commercial_premium_or_discount: number;
};

export type PhysicalOpportunityRow = {
  opportunity_id: string;
  vessel_name: string;
  trade_type: TradeType;
  route_code: string;
  delivery_area: string;
  redelivery_area: string;
  load_port: string;
  discharge_port: string;
  laycan_start: string;
  laycan_end: string;
  cargo_qty: number;
  freight_rate: number;
  tc_in_hire: number;
  tc_out_hire: number;
  voyage_days: number;
  ballast_days: number;
  laden_days: number;
  port_days: number;
  waiting_days: number;
  canal_days: number;
  commission_pct: number;
  port_costs: number;
  canal_costs: number;
  misc_costs: number;
  employment_status: "FIXED" | "OPEN" | "INDICATED" | "NONE";
  internal_freight_value?: number;
  route_exposure?: Record<string, number>;
};

export type BunkerRow = {
  date: string;
  port: string;
  VLSFO: number;
  HSFO: number;
  MGO: number;
  MFO: number;
  currency: string;
};

export type RouteDistanceRow = {
  route_code: string;
  benchmark_family: BenchmarkFamily;
  load_port: string;
  discharge_port: string;
  ballast_start: string;
  laden_distance: number;
  ballast_distance: number;
  canal_required: boolean;
  standard_waiting_days: number;
  standard_load_days: number;
  standard_discharge_days: number;
  weather_margin: number;
  standard_commission: number;
  standard_cargo_qty: number;
  exposure: Record<string, number>;
  route_notes?: string;
};

export type SettlementRule = {
  contractCode: string;
  settlementIndex: string;
  unit: Unit;
  settlementBasis: SettlementBasis;
  sourceSeries: string;
  periodType: PeriodType;
  componentFormula?: Array<{ indexCode: string; weight: number }>;
  derivedAdjustment?: number;
  multiplier?: number;
  usesPublishedDaysOnly: boolean;
  missingDataPolicy: "ERROR" | "IGNORE" | "PREVIOUS_PUBLISHED";
  gmbVersion?: string;
  sourceReference?: string;
  effectiveDate?: string;
  benchmarkFamily?: BenchmarkFamily;
  formula?: string;
  discontinued?: boolean;
  notes?: string;
};

export type RuleMetadata = {
  gmbVersion: string;
  sourceReference: string;
  effectiveDate: string;
  benchmarkFamily: BenchmarkFamily;
  unit: Unit;
  formula: string;
  settlementBasis?: SettlementBasis;
  discontinued: boolean;
  notes: string;
};

export type BalticPublicationCalendar = {
  publishedDates: string[];
  holidays: string[];
};

export type BenchmarkShip = {
  code: string;
  label: string;
  family: BenchmarkFamily;
  dwt: number;
  cbm?: number;
  grain_cbm?: number;
  scrubber_fitted: boolean;
  max_age?: number;
  loa?: number;
  beam?: number;
  draft?: number;
  tpc?: number;
  laden_speed: number;
  laden_consumption: number;
  ballast_speed: number;
  ballast_consumption: number;
  eco_laden_speed: number;
  eco_laden_consumption: number;
  eco_ballast_speed: number;
  eco_ballast_consumption: number;
  port_working_consumption: number;
  port_idle_consumption: number;
  mgo_at_sea?: number;
};

export type SettlementResult = {
  contractCode: string;
  rule: SettlementRule;
  observations: BalticIndexRow[];
  realized: BalticIndexRow[];
  remaining: BalticIndexRow[];
  missingObservationDates: string[];
  realizedDays: number;
  remainingDays: number;
  expectedSettlement: number;
  impliedRemaining?: number;
  paperEdgeShort: number;
  paperEdgeLong: number;
  formula: string;
  asOfDate: string;
  ruleVersion: string;
  dataQualityWarnings: string[];
  restatementHandling: string;
};

export type PhysicalResult = {
  actualGrossRevenue: number;
  fuelCost: number;
  voyageCosts: number;
  commission: number;
  actualTce: number;
  physicalEdge: number;
  benchmarkTce: number;
  benchmarkFreightPerMt: number;
  requiredFreightPerMt: number;
  requiredTcOut: number;
  shipSpecBasis: number;
  componentPnl: Record<string, number>;
  warnings: string[];
  sensitivity: Array<{ label: string; value: number; unit: string }>;
  formula: string;
};

export type ScrubberResult = {
  grossScrubberSaving: number;
  netScrubberSaving: number;
  scrubberValuePerDay: number;
  formula: string;
  warning?: string;
};

export type HedgeResult = {
  notional: number;
  notionalUnit: "days" | "mt";
  roundedLots: number;
  roundedNotional: number;
  executionPrice: number;
  transactionCosts: number;
  marginRequirement: number;
  residualExposure: number;
  effectivenessScore: number;
  paperPnl: number;
  warning?: string;
  warnings?: string[];
  formula: string;
};

export type RouteBasisResult = {
  physicalIndex: string;
  hedgeIndex: string;
  spread: number;
  rollingMean: number;
  rollingStdDev: number;
  zScore: number;
  beta: number;
  correlation: number;
  recommendedHedgeRatio: number;
  residualBasisRisk: number;
  confidence: number;
  warning?: RiskFlag;
  observations: number;
  formula: string;
};

export type BacktestResult = {
  status: "OK" | "INSUFFICIENT_DATA";
  missingFields: string[];
  equityCurve: Array<{ date: string; pnl: number; cumulativePnl: number }>;
  historicalPnl: number;
  hitRate: number;
  maxDrawdown: number;
  sharpeLike: number;
  falseSignalCount: number;
  routeBasisLoss: number;
  scrubberAttribution: number;
  settlementForecastError: number;
  formula: string;
};

export type AuditRun = {
  auditId: string;
  timestamp: string;
  sourceMetadata: Array<{ name: string; rows: number; versionId: string }>;
  gmbVersion: string;
  opportunityId: string;
  contractCode: string;
  asOfDate: string;
  inputs: unknown;
  outputs: unknown;
  warnings: string[];
  exportedReport?: string;
};

export type RiskFlag =
  | "NO_EMPLOYMENT_PLAN"
  | "UNIT_MISMATCH"
  | "SETTLEMENT_MISMATCH"
  | "ROUTE_MISMATCH"
  | "SCRUBBER_CAPTURE_ERROR"
  | "MISSING_BUNKER_DATA"
  | "MISSING_SETTLEMENT_DAYS"
  | "ILLIQUID_HEDGE";

export type SignalResult = {
  opportunity_id: string;
  vessel: string;
  route: string;
  trade_type: TradeType;
  physical_edge: number;
  ship_spec_basis: number;
  scrubber_value: number;
  paper_edge: number;
  route_basis: number;
  recommended_hedge: string;
  hedge_ratio: number;
  net_signal: number;
  confidence: number;
  risk_flag: RiskFlag | "CLEAR";
  recommendation:
    | "STRONG LONG PHYSICAL / SHORT PAPER"
    | "LONG PHYSICAL ONLY"
    | "PAPER ONLY"
    | "NO TRADE"
    | "DANGEROUS FALSE ARBITRAGE";
  explanation: string;
  formula: string;
};
