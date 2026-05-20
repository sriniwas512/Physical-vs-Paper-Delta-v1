import type { RuleMetadata } from "../types";
import { GMB_EFFECTIVE_DATE, GMB_VERSION } from "./gmbVersion";

export const physicalRouteIndices: Record<string, RuleMetadata & { description: string }> = {
  P1A_82: meta("PANAMAX", "$/day", "P1A_82 route TCE", "Panamax route P1A_82", "Atlantic round voyage", false),
  P2A_82: meta("PANAMAX", "$/day", "P2A_82 route TCE", "Panamax route P2A_82", "Atlantic to Asia fronthaul", false),
  P3A_82: meta("PANAMAX", "$/day", "P3A_82 route TCE", "Panamax route P3A_82", "Pacific round voyage", false),
  P4_82: meta("PANAMAX", "$/day", "P4_82 route TCE", "Panamax route P4_82", "Pacific to Atlantic backhaul; remains a physical route component.", false),
  P6_82: meta("PANAMAX", "$/day", "P6_82 route TCE", "Panamax route P6_82", "Singapore round voyage via Atlantic; 30% P5TC component.", false),
  P8: meta("PANAMAX", "$/mt", "P8 route freight", "Panamax route P8", "Physical route index is $/mt; P8-FFA settlement is a separate forward contract rule.", false),
  BLPG1: meta("BLPG", "$/mt", "BLPG1 freight $/mt", "BLPG route BLPG1", "44,000mt LPG Middle East Gulf to Japan, Ras Tanura to Chiba.", false),
  BLPG2: meta("BLPG", "$/mt", "BLPG2 freight $/mt", "BLPG route BLPG2", "44,000mt LPG US Gulf to Continent, Houston to Flushing.", false),
  BLPG3: meta("BLPG", "$/mt", "BLPG3 freight $/mt", "BLPG route BLPG3", "44,000mt LPG US Gulf to Japan, Houston to Chiba via Panama Canal.", false),
  "BLPG1-TCE": meta("BLPG", "$/day", "BLPG1-TCE", "BLPG TCE route BLPG1-TCE", "Round-voyage TCE equivalent for BLPG1.", false),
  "BLPG2-TCE": meta("BLPG", "$/day", "BLPG2-TCE", "BLPG TCE route BLPG2-TCE", "Round-voyage TCE equivalent for BLPG2.", false),
  "BLPG3-TCE": meta("BLPG", "$/day", "BLPG3-TCE", "BLPG TCE route BLPG3-TCE", "Round-voyage TCE equivalent for BLPG3.", false),
};

export const headlineIndices: Record<string, RuleMetadata & { componentFormula: Array<{ indexCode: string; weight: number }>; multiplier: number; rounding: string }> = {
  BPI: {
    ...meta("PANAMAX", "index", "RoundedSum(P1A_82*0.25, P2A_82*0.1, P3A_82*0.25, P4_82*0.10, P6_82*0.30)*0.111111", "Headline Indices, BPI", "Baltic Panamax Index headline formula.", false),
    componentFormula: [
      { indexCode: "P1A_82", weight: 0.25 },
      { indexCode: "P2A_82", weight: 0.1 },
      { indexCode: "P3A_82", weight: 0.25 },
      { indexCode: "P4_82", weight: 0.1 },
      { indexCode: "P6_82", weight: 0.3 },
    ],
    multiplier: 0.111111,
    rounding: "RoundedSum",
  },
  BLPG: {
    ...meta("BLPG", "index", "RoundedAverage(BLPG1-TCE, BLPG2-TCE, BLPG3-TCE)*0.1", "Headline Indices, BLPG", "Baltic LPG headline formula.", false),
    componentFormula: [
      { indexCode: "BLPG1-TCE", weight: 1 / 3 },
      { indexCode: "BLPG2-TCE", weight: 1 / 3 },
      { indexCode: "BLPG3-TCE", weight: 1 / 3 },
    ],
    multiplier: 0.1,
    rounding: "RoundedAverage",
  },
};

function meta(
  benchmarkFamily: RuleMetadata["benchmarkFamily"],
  unit: RuleMetadata["unit"],
  formula: string,
  sourceReference: string,
  notes: string,
  discontinued: boolean,
): RuleMetadata & { description: string } {
  return {
    gmbVersion: GMB_VERSION,
    sourceReference,
    effectiveDate: GMB_EFFECTIVE_DATE,
    benchmarkFamily,
    unit,
    formula,
    discontinued,
    notes,
    description: notes,
  };
}

