import { Anchor, ArrowLeftRight, BarChart3, ClipboardCheck, Database, Download, FileText, Gauge, GitCompareArrows, Ship, Waves } from "lucide-react";
import { useMemo, useState } from "react";
import { benchmarkShips } from "./data/mockData";
import { balticHeadlineRules, p5tcFormula, settlementRules } from "./lib/settlementEngine";
import { pct } from "./lib/format";
import { GMB_VERSION } from "./rules/gmbVersion";
import { physicalRouteIndices, headlineIndices } from "./rules/indexRegistry";
import { discontinuedContractRules, forwardContractRules } from "./rules/contractRegistry";
import { createWorkspaceFile, deserializeWorkspace, downloadTextFile, serializeWorkspace } from "./lib/workspace";
import { useLabStore } from "./store";
import { isFfaInMode } from "./lib/marketMode";
import { UploadWizard } from "./components/UploadWizard";
import { PhysicalOpportunityBuilder } from "./components/PhysicalOpportunityBuilder";
import { SettlementLab } from "./components/SettlementLab";
import { BasisWaterfall } from "./components/BasisWaterfall";
import { HedgeSimulator } from "./components/HedgeSimulator";
import { SignalMonitor } from "./components/SignalMonitor";
import { BacktestPanel } from "./components/BacktestPanel";
import { TradeExecutionPlan } from "./components/TradeExecutionPlan";
import { Panel, Tag } from "./components/common";
import "./index.css";

const nav = [
  { id: "health", label: "Data Health", icon: Database },
  { id: "registry", label: "Benchmark Registry", icon: Anchor },
  { id: "builder", label: "Opportunity Builder", icon: Ship },
  { id: "settlement", label: "Settlement Lab", icon: Waves },
  { id: "basis", label: "Basis Decomposition", icon: BarChart3 },
  { id: "hedge", label: "Hedge Simulator", icon: GitCompareArrows },
  { id: "signals", label: "Signal Monitor", icon: Gauge },
  { id: "execution", label: "Execution Plan", icon: ClipboardCheck },
  { id: "backtest", label: "Backtest", icon: FileText },
  { id: "export", label: "Export", icon: Download },
] as const;

type Page = (typeof nav)[number]["id"];

function App() {
  const [page, setPage] = useState<Page>("signals");
  const state = useLabStore();
  const activeOpportunity = state.opportunities.find((item) => item.opportunity_id === state.selectedOpportunityId);
  const activeContract = state.ffas.find((item) => item.contract_code === state.selectedContractCode);
  const activeBenchmarkShips = Object.values(benchmarkShips).filter((ship) => ship.family === state.marketMode);
  const activeSettlementRules = Object.values(settlementRules).filter((rule) =>
    isFfaInMode(
      {
        trade_date: "",
        contract_code: rule.contractCode,
        settlement_index: rule.settlementIndex,
        period_type: rule.periodType,
        period_start: "",
        period_end: "",
        price: 0,
        bid: 0,
        ask: 0,
        unit: rule.unit,
        lot_size: 0,
        source: "",
      },
      state.marketMode,
    ),
  );
  const registryRows = useMemo(
    () =>
      state.marketMode === "PANAMAX"
        ? [
            {
              label: "P5TC paper formula",
              value: p5tcFormula.map((item) => `${pct(item.weight)} ${item.indexCode}`).join(" + "),
            },
            {
              label: "BPI headline formula",
              value: balticHeadlineRules.BPI.formula,
            },
            {
              label: "Panamax route warning",
              value: "P6 physical hedged with P5TC leaves residual long P6 versus the P5TC basket.",
            },
          ]
        : [
            {
              label: "BLPG headline formula",
              value: balticHeadlineRules.BLPG.formula,
            },
            {
              label: "BLPG FFA unit rule",
              value: "BLPG1-FFA, BLPG2-FFA and BLPG3-FFA settle monthly in $/mt against BLPG1, BLPG2 and BLPG3 respectively.",
            },
            {
              label: "LPG route warning",
              value: "BLPG3 physical hedged with BLPG headline/composite leaves residual long BLPG3 versus the BLPG1/2/3 average.",
            },
          ],
    [state.marketMode],
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Ship /></div>
          <div>
            <strong>Baltic Real Ship Basis Lab</strong>
            <span>Physical vs paper arbitrage</span>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button className={page === item.id ? "active" : ""} key={item.id} onClick={() => setPage(item.id)}>
                <Icon />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <h1>Baltic Real Ship Basis Lab</h1>
            <p>Actual real ship economics, Baltic artificial ship settlement, route basis and paper mispricing in one client-side workbook.</p>
          </div>
          <div className="topbar-meta">
            <button
              className="market-toggle"
              onClick={() => state.setMarketMode(state.marketMode === "PANAMAX" ? "BLPG" : "PANAMAX")}
              title="Switch between Panamax dry bulk and LPG/BLPG index mode"
            >
              <span className={state.marketMode === "PANAMAX" ? "selected" : ""}>Panamax</span>
              <ArrowLeftRight />
              <span className={state.marketMode === "BLPG" ? "selected" : ""}>LPG</span>
            </button>
            <Tag tone="good">{activeOpportunity?.opportunity_id ?? "No opportunity"}</Tag>
            <Tag tone={activeContract?.unit === "$/mt" ? "warn" : "neutral"}>{activeContract?.contract_code ?? "No paper"}</Tag>
            <Tag>{GMB_VERSION}</Tag>
          </div>
        </header>

        <div className="summary-strip">
          <div><span>Physical leg</span><strong>Actual vessel TCE</strong></div>
          <div><span>Paper leg</span><strong>Baltic settlement economics</strong></div>
          <div><span>Signal</span><strong>Ship outperformance + paper edge - risk</strong></div>
        </div>

        {page === "health" ? <UploadWizard /> : null}
        {page === "registry" ? (
          <Panel title="Benchmark Registry" description="Separated GMB v8.4 rule registries for route indices, headline indices, contracts, discontinued contracts and benchmark ships.">
            <div className="registry-grid">
              {activeBenchmarkShips.map((ship) => (
                <article className="registry-card" key={ship.code}>
                  <div>
                    <h3>{ship.label}</h3>
                    <Tag tone="good">GMB default</Tag>
                  </div>
                  <dl>
                    <dt>DWT / CBM</dt><dd>{ship.dwt.toLocaleString()} / {(ship.cbm ?? ship.grain_cbm ?? 0).toLocaleString()}</dd>
                    <dt>Scrubber</dt><dd>{ship.scrubber_fitted ? "Fitted" : "Non-scrubber"}</dd>
                    <dt>Laden</dt><dd>{ship.laden_speed} kn · {ship.laden_consumption} mt/day</dd>
                    <dt>Ballast</dt><dd>{ship.ballast_speed} kn · {ship.ballast_consumption} mt/day</dd>
                    <dt>Eco</dt><dd>{ship.eco_laden_speed}/{ship.eco_ballast_speed} kn</dd>
                  </dl>
                </article>
              ))}
            </div>
            <div className="registry-rules">
              {registryRows.map((row) => (
                <div key={row.label}><b>{row.label}</b><span>{row.value}</span></div>
              ))}
              <div><b>Settlement rules</b><span>{activeSettlementRules.map((rule) => `${rule.contractCode}: ${rule.settlementBasis} ${rule.unit}`).join(" · ")}</span></div>
              <div><b>Forward contracts</b><span>{Object.keys(forwardContractRules).filter((code) => activeSettlementRules.some((rule) => rule.contractCode === code)).join(" · ")}</span></div>
              <div><b>Discontinued contracts</b><span>{Object.values(discontinuedContractRules).map((rule) => `${rule.contractCode}: ${rule.notes}`).join(" · ")}</span></div>
              <div><b>Physical route indices</b><span>{Object.values(physicalRouteIndices).filter((rule) => rule.benchmarkFamily === state.marketMode).map((rule) => `${rule.sourceReference} ${rule.unit}`).join(" · ")}</span></div>
              <div><b>Headline registry</b><span>{Object.values(headlineIndices).filter((rule) => rule.benchmarkFamily === state.marketMode).map((rule) => `${rule.sourceReference}: ${rule.formula}`).join(" · ")}</span></div>
            </div>
          </Panel>
        ) : null}
        {page === "builder" ? <PhysicalOpportunityBuilder /> : null}
        {page === "settlement" ? <SettlementLab /> : null}
        {page === "basis" ? <BasisWaterfall /> : null}
        {page === "hedge" ? <HedgeSimulator /> : null}
        {page === "signals" ? <SignalMonitor /> : null}
        {page === "execution" ? <TradeExecutionPlan /> : null}
        {page === "backtest" ? <BacktestPanel /> : null}
        {page === "export" ? <ExportPanel /> : null}
      </main>
    </div>
  );
}

function ExportPanel() {
  const state = useLabStore();
  const { selectedOpportunityId, selectedContractCode } = state;
  const markdown = `# Trade thesis\nLong physical opportunity ${selectedOpportunityId} against short ${selectedContractCode} where the real ship outperforms the Baltic benchmark ship and paper is rich versus expected settlement.\n\n## Settlement mechanism\nUse registered settlement rule, separate realized Baltic prints from remaining forecast days, and do not compare $/mt BLPG paper directly with $/day TCE.\n\n## Risk flags\nEmployment plan, route mismatch, settlement mismatch, scrubber capture and bunker data are reviewed before signal approval.`;
  const snapshot = {
    baltic: state.baltic,
    ffas: state.ffas,
    vessels: state.vessels,
    opportunities: state.opportunities,
    bunkers: state.bunkers,
    routes: state.routes,
    publicationCalendar: state.publicationCalendar,
    marketMode: state.marketMode,
    selectedOpportunityId: state.selectedOpportunityId,
    selectedContractCode: state.selectedContractCode,
    forecastMode: state.forecastMode,
    scrubberMode: state.scrubberMode,
    hedgeRatio: state.hedgeRatio,
    hedgeSide: state.hedgeSide,
    asOfDate: state.asOfDate,
  };
  return (
    <Panel title="Export" description="Explicit workspace export/import plus CSV-ready table data and PDF-ready markdown report text.">
      <textarea readOnly value={markdown} />
      <div className="toolbar">
        <button
          onClick={() => {
            const workspace = createWorkspaceFile(snapshot);
            downloadTextFile(`basis-lab-workspace-${Date.now()}.json`, serializeWorkspace(workspace));
          }}
        >
          Export workspace JSON
        </button>
        <label className="button-like">
          Import workspace JSON
          <input
            type="file"
            accept=".json"
            hidden
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              const workspace = deserializeWorkspace(await file.text());
              state.importWorkspace(workspace.state);
            }}
          />
        </label>
        <button onClick={() => navigator.clipboard.writeText(markdown)}>Copy markdown</button>
        <button onClick={() => navigator.clipboard.writeText("opportunity_id,contract_code,thesis\n" + `${selectedOpportunityId},${selectedContractCode},long physical short paper`)}>Copy CSV</button>
      </div>
    </Panel>
  );
}

export default App;
