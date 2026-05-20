import type { PhysicalOpportunityRow, ScrubberCaptureMode, ScrubberResult, VesselSpecRow } from "../types";

export function calculateScrubberValue(input: {
  vessel: VesselSpecRow;
  opportunity: PhysicalOpportunityRow;
  mode: ScrubberCaptureMode;
  ownerSharePct: number;
  hsfoPrice: number;
  vlsfoPrice: number;
  eligibleScrubberSeaDays: number;
  eligibleScrubberLadenDays?: number;
  eligibleScrubberBallastDays?: number;
  scrubberOffDays: number;
  extraScrubberOpexPerDay: number;
  washwaterRestrictionAdjustment: number;
}): ScrubberResult {
  if (!input.vessel.scrubber_fitted) {
    return {
      grossScrubberSaving: 0,
      netScrubberSaving: 0,
      scrubberValuePerDay: 0,
      formula: "No scrubber fitted, so scrubber value is zero.",
    };
  }

  const eligibleLadenDays = input.eligibleScrubberLadenDays ?? input.eligibleScrubberSeaDays;
  const eligibleBallastDays = input.eligibleScrubberBallastDays ?? 0;
  const downtimeFactor = input.eligibleScrubberSeaDays
    ? Math.max(input.eligibleScrubberSeaDays - input.scrubberOffDays, 0) / input.eligibleScrubberSeaDays
    : 0;
  const effectiveLadenDays = eligibleLadenDays * downtimeFactor;
  const effectiveBallastDays = eligibleBallastDays * downtimeFactor;
  const grossScrubberSaving =
    (input.vlsfoPrice - input.hsfoPrice) *
    (input.vessel.laden_consumption * effectiveLadenDays + input.vessel.ballast_consumption * effectiveBallastDays);
  const effectiveDays = effectiveLadenDays + effectiveBallastDays;
  const extraOpex = input.extraScrubberOpexPerDay * effectiveDays;
  const ownerShare =
    input.mode === "SHARED" ? grossScrubberSaving * (input.ownerSharePct / 100) : input.mode === "OWNER_RETAINS" ? grossScrubberSaving : 0;
  const tcOutCap = input.mode === "TC_OUT_MARKET_PREMIUM_ONLY" ? input.opportunity.tc_out_hire * 0.05 * input.opportunity.voyage_days : 0;
  const netBeforeCap = grossScrubberSaving - extraOpex - ownerShare - input.washwaterRestrictionAdjustment;
  const netScrubberSaving = input.mode === "TC_OUT_MARKET_PREMIUM_ONLY" ? Math.min(netBeforeCap, tcOutCap) : netBeforeCap;
  const warning = captureWarning(input);

  return {
    grossScrubberSaving,
    netScrubberSaving,
    scrubberValuePerDay: input.opportunity.voyage_days ? netScrubberSaving / input.opportunity.voyage_days : 0,
    warning,
    formula: `Gross scrubber saving = (VLSFO ${input.vlsfoPrice} - HSFO ${input.hsfoPrice}) x (${input.vessel.laden_consumption} mt/day x ${round(effectiveLadenDays)} laden days + ${input.vessel.ballast_consumption} mt/day x ${round(effectiveBallastDays)} ballast days). Net subtracts downtime, opex, owner share and washwater restriction adjustment.`,
  };
}

function captureWarning(input: Parameters<typeof calculateScrubberValue>[0]): string | undefined {
  if (input.opportunity.trade_type === "TC_IN_AND_TC_OUT" && input.mode !== "TC_OUT_MARKET_PREMIUM_ONLY") {
    return "SCRUBBER_CAPTURE_ERROR: TC-out structures should use observed/assumed TC-out scrubber premium unless the charterparty gives charterer the bunker benefit.";
  }
  if (["TC_IN_AND_VOYAGE", "CARGO_COVER", "COA_COVER", "VOYAGE_RELET"].includes(input.opportunity.trade_type) && input.mode === "OWNER_RETAINS") {
    return "SCRUBBER_CAPTURE_RISK: voyage-style exposure may capture bunker economics only if the user actually pays bunkers under the charterparty.";
  }
  return undefined;
}

const round = (value: number) => Math.round(value * 100) / 100;
