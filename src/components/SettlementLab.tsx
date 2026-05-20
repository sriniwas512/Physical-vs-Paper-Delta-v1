import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { calculateSettlement, settlementRules } from "../lib/settlementEngine";
import { number, rate } from "../lib/format";
import { defaultContractByMode, isFfaInMode } from "../lib/marketMode";
import { useLabStore } from "../store";
import { Metric, Panel, Tag } from "./common";

export function SettlementLab() {
  const { baltic, ffas, selectedContractCode, setSelectedContractCode, forecastMode, setForecastMode, asOfDate, setAsOfDate } = useLabStore();
  const marketMode = useLabStore((state) => state.marketMode);
  const activeFfas = ffas.filter((ffa) => isFfaInMode(ffa, marketMode));
  const contract =
    activeFfas.find((row) => row.contract_code === selectedContractCode) ??
    activeFfas.find((row) => row.contract_code === defaultContractByMode[marketMode]) ??
    activeFfas[0];
  const rule = settlementRules[contract.contract_code] ?? settlementRules["P5TC-FFA"];
  const settlement = calculateSettlement(contract, rule, baltic, {
    asOfDate,
    forecastMode,
  });
  const chartRows = settlement.observations.map((row) => ({
    date: row.date.slice(5),
    actual: settlement.realized.some((realized) => realized.date === row.date) ? row.value : undefined,
    forecast: settlement.remaining.some((remaining) => remaining.date === row.date)
      ? settlement.realized.at(-1)?.value ?? row.value
      : undefined,
    implied: settlement.impliedRemaining,
  }));

  return (
    <Panel title="Settlement Lab" description="Prompt-month split between printed Baltic observations and remaining settlement risk.">
      <div className="toolbar">
        <select value={selectedContractCode} onChange={(event) => setSelectedContractCode(event.target.value)}>
          {activeFfas.map((ffa) => (
            <option key={ffa.contract_code}>{ffa.contract_code}</option>
          ))}
        </select>
        <select value={forecastMode} onChange={(event) => setForecastMode(event.target.value as never)}>
          <option value="FLAT_FORWARD">Flat forward</option>
          <option value="STATISTICAL">Trailing average</option>
          <option value="USER_FORECAST">User forecast</option>
        </select>
        <label className="inline-field">
          As-of
          <input type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} />
        </label>
        <Tag>{rule.settlementBasis}</Tag>
        <Tag tone={rule.unit === "$/mt" ? "warn" : "neutral"}>{rule.unit}</Tag>
        <Tag>{rule.gmbVersion ?? "No rule version"}</Tag>
      </div>
      <div className="metric-grid four">
        <Metric label="Market FFA" value={rate(contract.price, contract.unit)} formula="Uploaded FFA/futures price." />
        <Metric label="Expected settlement" value={rate(settlement.expectedSettlement, rule.unit)} formula={settlement.formula} />
        <Metric label="Realized / remaining" value={`${settlement.realizedDays} / ${settlement.remainingDays}`} unit="published days" formula={settlement.formula} />
        <Metric label="Implied remaining" value={settlement.impliedRemaining ? rate(settlement.impliedRemaining, rule.unit) : "N/A"} formula="(FFA price x total observations - realized sum) / remaining observations." />
      </div>
      <div className="registry-rules">
        <div><b>Rule trace</b><span>{settlement.ruleVersion}</span></div>
        <div><b>Observed prints</b><span>{settlement.observations.length} total · {settlement.realizedDays} realized · {settlement.remainingDays} remaining</span></div>
        <div><b>Data warnings</b><span>{settlement.dataQualityWarnings.length ? settlement.dataQualityWarnings.join(" · ") : "CLEAR"}</span></div>
        <div><b>Restatement</b><span>{settlement.restatementHandling}</span></div>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartRows}>
            <CartesianGrid stroke="#26313d" vertical={false} />
            <XAxis dataKey="date" stroke="#7b8794" tickLine={false} />
            <YAxis stroke="#7b8794" tickFormatter={(value) => number(Number(value))} width={72} />
            <Tooltip contentStyle={{ background: "#111820", border: "1px solid #26313d", color: "#e8eef5" }} />
            <Area type="monotone" dataKey="forecast" fill="#315c72" stroke="#61c4d7" fillOpacity={0.28} connectNulls />
            <Line type="monotone" dataKey="actual" stroke="#e0b15d" strokeWidth={2} connectNulls />
            <ReferenceLine y={settlement.impliedRemaining} stroke="#e75f7f" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="implied" stroke="#e75f7f" strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
