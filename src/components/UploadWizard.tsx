import { AlertTriangle, CheckCircle2, FileUp } from "lucide-react";
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
] as const;

export function UploadWizard() {
  const ingest = useLabStore((state) => state.ingest);
  const balticCount = useLabStore((state) => state.baltic.length);
  const ffaCount = useLabStore((state) => state.ffas.length);
  const vesselCount = useLabStore((state) => state.vessels.length);
  const opportunityCount = useLabStore((state) => state.opportunities.length);
  const bunkerCount = useLabStore((state) => state.bunkers.length);
  const routeCount = useLabStore((state) => state.routes.length);
  const counts = {
    baltic: balticCount,
    ffas: ffaCount,
    vessels: vesselCount,
    opportunities: opportunityCount,
    bunkers: bunkerCount,
    routes: routeCount,
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
                const result = await parseUploadedFile(file, dataset.key);
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
      </div>
    </Panel>
  );
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
