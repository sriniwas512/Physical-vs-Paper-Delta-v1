import { AlertTriangle, CheckCircle2, FileUp } from "lucide-react";
import { useState } from "react";
import { parseUploadedFile } from "../lib/parsers";
import { useLabStore } from "../store";
import { Panel, Tag } from "./common";

const datasets = [
  { key: "baltic", label: "Baltic spot/index data", target: "baltic" },
  { key: "ffa", label: "FFA/futures data", target: "ffas" },
  { key: "vessel", label: "Vessel specifications", target: "vessels" },
  { key: "opportunity", label: "Physical opportunities", target: "opportunities" },
  { key: "bunker", label: "Bunker prices", target: "bunkers" },
  { key: "route", label: "Route distances", target: "routes" },
  { key: "calendar", label: "Baltic publication calendar", target: "publicationCalendar" },
] as const;

type UploadReport = {
  label: string;
  rows: number;
  warnings: string[];
  errors: string[];
  columns: string[];
  previewRows: Record<string, unknown>[];
  rejectedRows: Array<{ rowNumber: number; row: Record<string, unknown>; errors: string[] }>;
};

export function UploadWizard() {
  const ingest = useLabStore((state) => state.ingest);
  const balticCount = useLabStore((state) => state.baltic.length);
  const ffaCount = useLabStore((state) => state.ffas.length);
  const vesselCount = useLabStore((state) => state.vessels.length);
  const opportunityCount = useLabStore((state) => state.opportunities.length);
  const bunkerCount = useLabStore((state) => state.bunkers.length);
  const routeCount = useLabStore((state) => state.routes.length);
  const calendarCount = useLabStore((state) => state.publicationCalendar.length);
  const [report, setReport] = useState<UploadReport | null>(null);
  const counts = {
    baltic: balticCount,
    ffas: ffaCount,
    vessels: vesselCount,
    opportunities: opportunityCount,
    bunkers: bunkerCount,
    routes: routeCount,
    publicationCalendar: calendarCount,
  };

  return (
    <Panel
      title="Data Health"
      description="Upload CSV/XLSX, validate required columns with zod, and keep the mock book live until replaced."
    >
      <div className="upload-grid">
        {datasets.map((dataset) => (
          <div className="upload-tile" key={dataset.key}>
            <div>
              <FileUp />
              <strong>{dataset.label}</strong>
              <span>{counts[dataset.target]} rows active</span>
            </div>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              title={`Upload ${dataset.label}`}
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) return;
                const result = await parseUploadedFile(file, dataset.key, { columnMap: defaultColumnMap(dataset.key) });
                setReport({
                  label: dataset.label,
                  rows: result.rows.length,
                  warnings: result.warnings,
                  errors: result.errors,
                  columns: result.columns,
                  previewRows: result.previewRows,
                  rejectedRows: result.rejectedRows,
                });
                if (!result.errors.length) {
                  ingest(dataset.target, result.rows as never);
                } else {
                  window.alert(`Validation failed:\n${result.errors.slice(0, 8).join("\n")}`);
                }
              }}
            />
          </div>
        ))}
      </div>
      <div className="health-list">
        <HealthItem ok label="Mock Panamax and BLPG books loaded" />
        <HealthItem ok label="Settlement rules include month-average and last-seven-day contracts" />
        <HealthItem ok={counts.bunkers > 0} label="Bunker curves available by port/date" />
        <HealthItem ok={counts.routes > 0} label="Route exposure vectors mapped" />
        <HealthItem ok={counts.publicationCalendar > 0} label="Publication calendar uploaded for benchmark-grade settlement windows" />
      </div>
      {report ? (
        <div className="upload-report">
          <div className="toolbar">
            <Tag tone={report.errors.length ? "warn" : "good"}>{report.label}</Tag>
            <Tag>{report.rows} accepted rows</Tag>
            <Tag tone={report.rejectedRows.length ? "warn" : "neutral"}>{report.rejectedRows.length} rejected rows</Tag>
          </div>
          <div className="registry-rules">
            <div><b>Detected columns</b><span>{report.columns.join(" · ") || "None"}</span></div>
            <div><b>Warnings</b><span>{report.warnings.join(" · ") || "CLEAR"}</span></div>
            <div><b>Errors</b><span>{report.errors.slice(0, 6).join(" · ") || "None"}</span></div>
          </div>
          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>{Object.keys(report.previewRows[0] ?? {}).slice(0, 8).map((key) => <th key={key}>{key}</th>)}</tr>
              </thead>
              <tbody>
                {report.previewRows.slice(0, 4).map((row, index) => (
                  <tr key={index}>{Object.keys(report.previewRows[0] ?? {}).slice(0, 8).map((key) => <td key={key}>{String(row[key] ?? "")}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.rejectedRows.length ? <div className="warning-line">First rejected row {report.rejectedRows[0].rowNumber}: {report.rejectedRows[0].errors.join(" · ")}</div> : null}
        </div>
      ) : null}
    </Panel>
  );
}

function defaultColumnMap(dataset: (typeof datasets)[number]["key"]): Record<string, string> {
  if (dataset === "baltic") {
    return {
      trade_date: "date",
      index: "index_code",
      index_name: "index_code",
      settlement: "value",
      assessment: "value",
    };
  }
  if (dataset === "calendar") {
    return {
      published: "is_published",
      publication_day: "is_published",
      holiday: "is_holiday",
    };
  }
  return {};
}

function HealthItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="health-item">
      {ok ? <CheckCircle2 /> : <AlertTriangle />}
      <span>{label}</span>
      <Tag tone={ok ? "good" : "warn"}>{ok ? "OK" : "Review"}</Tag>
    </div>
  );
}
