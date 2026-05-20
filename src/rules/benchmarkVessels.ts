import type { BenchmarkShip } from "../types";
import { GMB_EFFECTIVE_DATE, GMB_VERSION } from "./gmbVersion";

export const benchmarkVesselRules: Record<string, BenchmarkShip & {
  gmbVersion: string;
  sourceReference: string;
  effectiveDate: string;
  notes: string;
}> = {
  BPI82_STANDARD_SHIP: {
    code: "BPI82_STANDARD_SHIP",
    label: "BPI82 Panamax 82k non-scrubber",
    family: "PANAMAX",
    dwt: 82500,
    loa: 229,
    beam: 32.25,
    draft: 14.43,
    tpc: 70.5,
    grain_cbm: 97000,
    scrubber_fitted: false,
    max_age: 12,
    laden_speed: 13.5,
    laden_consumption: 33,
    ballast_speed: 14,
    ballast_consumption: 31,
    eco_laden_speed: 11.5,
    eco_laden_consumption: 22,
    eco_ballast_speed: 12.5,
    eco_ballast_consumption: 23,
    port_working_consumption: 4,
    port_idle_consumption: 3,
    mgo_at_sea: 0.1,
    gmbVersion: GMB_VERSION,
    sourceReference: "Panamax 82 Vessel Description, May 2026 GMG",
    effectiveDate: GMB_EFFECTIVE_DATE,
    notes: "Non-scrubber 82,500 dwt benchmark ship, max age 12 years, 97,000 cbm grain.",
  },
  VLGC84_STANDARD_SHIP: {
    code: "VLGC84_STANDARD_SHIP",
    label: "VLGC84 Baltic non-scrubber",
    family: "BLPG",
    dwt: 54500,
    cbm: 84000,
    scrubber_fitted: false,
    loa: 225,
    beam: 36.5,
    draft: 12,
    ballast_speed: 16,
    ballast_consumption: 43,
    laden_speed: 16,
    laden_consumption: 48,
    eco_ballast_speed: 13.5,
    eco_ballast_consumption: 28,
    eco_laden_speed: 13,
    eco_laden_consumption: 29,
    port_working_consumption: 10,
    port_idle_consumption: 5,
    gmbVersion: GMB_VERSION,
    sourceReference: "BLPG VLGC84 Vessel Description, May 2026 GMG",
    effectiveDate: GMB_EFFECTIVE_DATE,
    notes: "Non-scrubber 84,000 cbm VLGC benchmark ship.",
  },
};

