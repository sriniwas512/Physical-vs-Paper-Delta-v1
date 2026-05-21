import { describe, expect, it } from "vitest";
import { parseUploadedFile } from "./parsers";

describe("parseUploadedFile attached Panamax formats", () => {
  it("derives Baltic index code and unit from Panamax history workbook names", async () => {
    const file = new File(["Date,Value,Spread\n21-May-2026,20485,1350\n"], "Panamax - P5TC 220525 210526.csv");
    const result = await parseUploadedFile(file, "baltic");

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      date: "2026-05-21",
      index_code: "P5TC",
      value: 20485,
      unit: "$/day",
    });
  });

  it("normalizes forward curve rows with Route Period Value Unit Date columns", async () => {
    const file = new File(
      ["Route,Period,Value,Unit,Date\nP6CURMON,May 26,\"21,444\",$,20-May-2026\n"],
      "P6-FFA 020118 020728.csv",
    );
    const result = await parseUploadedFile(file, "ffa");

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      trade_date: "2026-05-20",
      contract_code: "P6-FFA",
      settlement_index: "P6_82",
      period_type: "MONTH",
      period_start: "2026-05-01",
      period_end: "2026-05-31",
      price: 21444,
      unit: "$/day",
    });
  });
});

