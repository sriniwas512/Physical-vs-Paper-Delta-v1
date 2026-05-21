import { describe, expect, it } from "vitest";
import { createWorkspaceFile, deserializeWorkspace, serializeWorkspace } from "./workspace";
import { balticIndexData, ffaContracts } from "../data/panamaxSeedData";
import { bunkerFixture, opportunityFixture, routeFixture, vesselFixture } from "./testFixtures";

describe("workspace export/import", () => {
  it("round trips datasets, settings and publication calendar", () => {
    const workspace = createWorkspaceFile({
      baltic: balticIndexData.slice(0, 2),
      ffas: ffaContracts.slice(0, 1),
      vessels: [vesselFixture],
      opportunities: [opportunityFixture],
      bunkers: [bunkerFixture],
      routes: [routeFixture],
      publicationCalendar: [{ date: "2026-05-01", is_published: true, is_holiday: false }],
      marketMode: "PANAMAX",
      selectedOpportunityId: opportunityFixture.opportunity_id,
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
