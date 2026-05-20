import type { SettlementBasis } from "../types";

export const settlementMethodologies: Record<SettlementBasis, { label: string; notes: string }> = {
  MONTH_AVERAGE: {
    label: "Month average",
    notes: "Use all published Baltic assessment days for the settlement index inside the contract month.",
  },
  LAST_7_PUBLISHED_DAYS: {
    label: "Last seven published days",
    notes: "Use the final seven published Baltic assessment days for the settlement index inside the contract month.",
  },
  QUARTER_AVERAGE: {
    label: "Quarter average",
    notes: "Use all published Baltic assessment days between the contract quarter start and end dates.",
  },
  CALENDAR_AVERAGE: {
    label: "Calendar average",
    notes: "Use all published Baltic assessment days in the contract calendar year.",
  },
  CUSTOM_BASKET: {
    label: "Custom basket",
    notes: "Calculate the daily basket value from components first, then apply the relevant averaging window.",
  },
};

