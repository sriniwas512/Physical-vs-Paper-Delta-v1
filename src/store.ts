import { create } from "zustand";
import { format } from "date-fns";
import {
  balticIndexData,
  bunkers,
  ffaContracts,
  opportunities,
  routes,
  vessels,
} from "./data/mockData";
import type {
  BalticIndexRow,
  BenchmarkFamily,
  BunkerRow,
  FfaContractRow,
  ForecastMode,
  PhysicalOpportunityRow,
  RouteDistanceRow,
  ScrubberCaptureMode,
  VesselSpecRow,
} from "./types";
import { defaultContractByMode, defaultOpportunityByMode } from "./lib/marketMode";

type LabStore = {
  baltic: BalticIndexRow[];
  ffas: FfaContractRow[];
  vessels: VesselSpecRow[];
  opportunities: PhysicalOpportunityRow[];
  bunkers: BunkerRow[];
  routes: RouteDistanceRow[];
  marketMode: BenchmarkFamily;
  selectedOpportunityId: string;
  selectedContractCode: string;
  forecastMode: ForecastMode;
  scrubberMode: ScrubberCaptureMode;
  hedgeRatio: number;
  hedgeSide: "LONG" | "SHORT";
  asOfDate: string;
  setMarketMode: (mode: BenchmarkFamily) => void;
  setSelectedOpportunityId: (id: string) => void;
  setSelectedContractCode: (code: string) => void;
  setForecastMode: (mode: ForecastMode) => void;
  setScrubberMode: (mode: ScrubberCaptureMode) => void;
  setHedgeRatio: (ratio: number) => void;
  setAsOfDate: (date: string) => void;
  ingest: <K extends "baltic" | "ffas" | "vessels" | "opportunities" | "bunkers" | "routes">(
    key: K,
    rows: LabStore[K],
  ) => void;
};

export const useLabStore = create<LabStore>((set) => ({
  baltic: balticIndexData,
  ffas: ffaContracts,
  vessels,
  opportunities,
  bunkers,
  routes,
  marketMode: "BLPG",
  selectedOpportunityId: opportunities[1].opportunity_id,
  selectedContractCode: "BLPG3-FFA",
  forecastMode: "FLAT_FORWARD",
  scrubberMode: "CHARTERER_RETAINS",
  hedgeRatio: 0.9,
  hedgeSide: "SHORT",
  asOfDate: format(new Date(), "yyyy-MM-dd"),
  setMarketMode: (marketMode) =>
    set({
      marketMode,
      selectedOpportunityId: defaultOpportunityByMode[marketMode],
      selectedContractCode: defaultContractByMode[marketMode],
    }),
  setSelectedOpportunityId: (selectedOpportunityId) => set({ selectedOpportunityId }),
  setSelectedContractCode: (selectedContractCode) => set({ selectedContractCode }),
  setForecastMode: (forecastMode) => set({ forecastMode }),
  setScrubberMode: (scrubberMode) => set({ scrubberMode }),
  setHedgeRatio: (hedgeRatio) => set({ hedgeRatio }),
  setAsOfDate: (asOfDate) => set({ asOfDate }),
  ingest: (key, rows) => set({ [key]: rows } as Pick<LabStore, typeof key>),
}));
