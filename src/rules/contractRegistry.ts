import type { SettlementRule } from "../types";
import { GMB_EFFECTIVE_DATE, GMB_VERSION } from "./gmbVersion";

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
  gmbVersion: GMB_VERSION,
  sourceReference: "May 2026 GMG BFA settlement table",
  effectiveDate: GMB_EFFECTIVE_DATE,
  benchmarkFamily: unit === "$/mt" ? "BLPG" : "PANAMAX",
  formula: `${settlementBasis} of ${settlementIndex}`,
  discontinued: false,
  notes: "",
  ...options,
});

export const forwardContractRules: Record<string, SettlementRule> = {
  "P5TC-FFA": baseRule("P5TC-FFA", "P5TC", "$/day", "MONTH_AVERAGE", { notes: "Panamax timecharter basket FFA, monthly average." }),
  "P6-FFA": baseRule("P6-FFA", "P6_82", "$/day", "MONTH_AVERAGE"),
  "P8-FFA": baseRule("P8-FFA", "P8", "$/day", "MONTH_AVERAGE", { notes: "Forward contract settles as $/pd in the BFA table; do not confuse with the physical P8 $/mt route index." }),
  "P1A_03-FFA": baseRule("P1A_03-FFA", "P1A_03", "$/pt", "MONTH_AVERAGE", { sourceSeries: "P1A_82", derivedAdjustment: -1284 }),
  "P2A_03-FFA": baseRule("P2A_03-FFA", "P2A_03", "$/pt", "MONTH_AVERAGE", { sourceSeries: "P2A_82", derivedAdjustment: -1489 }),
  "P3A_03-FFA": baseRule("P3A_03-FFA", "P3A_03", "$/pt", "MONTH_AVERAGE", { sourceSeries: "P3A_82", derivedAdjustment: -1302 }),
  "P1EA_03-FFA": baseRule("P1EA_03-FFA", "P1A_03", "$/pt", "LAST_7_PUBLISHED_DAYS", { sourceSeries: "P1A_82", derivedAdjustment: -1284 }),
  "P2EA_03-FFA": baseRule("P2EA_03-FFA", "P2A_03", "$/pt", "LAST_7_PUBLISHED_DAYS", { sourceSeries: "P2A_82", derivedAdjustment: -1489 }),
  "P3EA_03-FFA": baseRule("P3EA_03-FFA", "P3A_03", "$/pt", "LAST_7_PUBLISHED_DAYS", { sourceSeries: "P3A_82", derivedAdjustment: -1302 }),
  "P1A_82-FFA": baseRule("P1A_82-FFA", "P1A_82", "$/day", "LAST_7_PUBLISHED_DAYS"),
  "P2A_82-FFA": baseRule("P2A_82-FFA", "P2A_82", "$/day", "LAST_7_PUBLISHED_DAYS"),
  "P3A_82-FFA": baseRule("P3A_82-FFA", "P3A_82", "$/day", "LAST_7_PUBLISHED_DAYS"),
  "P1EA_82-FFA": baseRule("P1EA_82-FFA", "P1A_82", "$/day", "MONTH_AVERAGE"),
  "P2EA_82-FFA": baseRule("P2EA_82-FFA", "P2A_82", "$/day", "MONTH_AVERAGE"),
  "P3EA_82-FFA": baseRule("P3EA_82-FFA", "P3A_82", "$/day", "MONTH_AVERAGE"),
  "BLPG1-FFA": baseRule("BLPG1-FFA", "BLPG1", "$/mt", "MONTH_AVERAGE", { benchmarkFamily: "BLPG", notes: "Monthly average $/mt settlement against BLPG1." }),
  "BLPG2-FFA": baseRule("BLPG2-FFA", "BLPG2", "$/mt", "MONTH_AVERAGE", { benchmarkFamily: "BLPG", notes: "Monthly average $/mt settlement against BLPG2." }),
  "BLPG3-FFA": baseRule("BLPG3-FFA", "BLPG3", "$/mt", "MONTH_AVERAGE", { benchmarkFamily: "BLPG", notes: "Monthly average $/mt settlement against BLPG3." }),
};

export const discontinuedContractRules: Record<string, SettlementRule> = {
  "P4TC-FFA": baseRule("P4TC-FFA", "P4TC", "$/day", "MONTH_AVERAGE", {
    discontinued: true,
    notes: "P4TC-FFA removed in GMG v8.4. P4_82 remains a physical route component in the P5TC/BPI basket.",
  }),
};

export const allContractRules: Record<string, SettlementRule> = {
  ...forwardContractRules,
  ...discontinuedContractRules,
};

