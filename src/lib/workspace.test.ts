import { describe, expect, it } from "vitest";
import { createWorkspaceFile, deserializeWorkspace, serializeWorkspace } from "./workspace";
import { balticIndexData, bunkers, ffaContracts, opportunities, routes, vessels } from "../data/mockData";

describe("workspace export/import", () => {
  it("round trips datasets, settings and publication calendar", () => {
    const workspace = createWorkspaceFile({
      baltic: balticIndexData.slice(0, 2),
      ffas: ffaContracts.slice(0, 1),
      vessels: vessels.slice(0, 1),
      opportunities: opportunities.slice(0, 1),
      bunkers: bunkers.slice(0, 1),
      routes: routes.slice(0, 1),
      publicationCalendar: [{ date: "2026-05-01", is_published: true, is_holiday: false }],
      marketMode: "PANAMAX",
      selectedOpportunityId: opportunities[0].opportunity_id,
      selectedContractCode: ffaContracts[0].contract_code,
      forecastMode: "FLAT_FORWARD",
      scrubberMode: "CHARTERER_RETAINS",
      hedgeRatio: 1,
      hedgeSide: "SHORT",
      asOfDate: "2026-05-21",
    });

    expect(deserializeWorkspace(serializeWorkspace(workspace))).toEqual(workspace);
  });
});

