import type { PhysicalOpportunityRow, ScrubberCaptureMode, ScrubberResult, VesselSpecRow } from "../types";

export function calculateScrubberValue(input: {
  vessel: VesselSpecRow;
  opportunity: PhysicalOpportunityRow;
  mode: ScrubberCaptureMode;
  ownerSharePct: number;
  hsfoPrice: number;
  vlsfoPrice: number;
  eligibleScrubberSeaDays: number;
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

  const effectiveDays = Math.max(input.eligibleScrubberSeaDays - input.scrubberOffDays, 0);
  const grossScrubberSaving =
    (input.vlsfoPrice - input.hsfoPrice) * input.vessel.laden_consumption * effectiveDays;
  const extraOpex = input.extraScrubberOpexPerDay * effectiveDays;
  const ownerShare =
    input.mode === "SHARED" ? grossScrubberSaving * (input.ownerSharePct / 100) : input.mode === "OWNER_RETAINS" ? grossScrubberSaving : 0;
  const tcOutCap = input.mode === "TC_OUT_MARKET_PREMIUM_ONLY" ? input.opportunity.tc_out_hire * 0.05 * input.opportunity.voyage_days : 0;
  const netBeforeCap = grossScrubberSaving - extraOpex - ownerShare - input.washwaterRestrictionAdjustment;
  const netScrubberSaving = input.mode === "TC_OUT_MARKET_PREMIUM_ONLY" ? Math.min(netBeforeCap, tcOutCap) : netBeforeCap;
  const warning =
    input.opportunity.trade_type === "TC_IN_AND_TC_OUT" && input.mode !== "TC_OUT_MARKET_PREMIUM_ONLY"
      ? "SCRUBBER_CAPTURE_ERROR: TC-out structures should use observed/assumed TC-out scrubber premium unless the charterparty gives charterer the bunker benefit."
      : undefined;

  return {
    grossScrubberSaving,
    netScrubberSaving,
    scrubberValuePerDay: input.opportunity.voyage_days ? netScrubberSaving / input.opportunity.voyage_days : 0,
    warning,
    formula: `Gross scrubber saving = (VLSFO ${input.vlsfoPrice} - HSFO ${input.hsfoPrice}) x ${input.vessel.laden_consumption} mt/day x ${round(effectiveDays)} eligible days. Net subtracts opex, owner share and washwater restriction adjustment.`,
  };
}

const round = (value: number) => Math.round(value * 100) / 100;
