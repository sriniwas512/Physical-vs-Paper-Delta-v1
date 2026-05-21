import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useLabStore } from "../store";
import { runBacktest } from "../lib/backtestEngine";
import { money } from "../lib/format";
import { Panel, Metric, Tag } from "./common";

export function BacktestPanel() {
  const state = useLabStore();
  const opportunity = state.opportunities.find((item) => item.opportunity_id === state.selectedOpportunityId);
  const vessel = state.vessels.find((item) => item.vessel_name === opportunity?.vessel_name);
  const route = state.routes.find((item) => item.route_code === opportunity?.route_code);
  const result = runBacktest({
    indexData: state.baltic,
    ffas: state.ffas.filter((ffa) => ffa.contract_code === state.selectedContractCode),
    bunkers: state.bunkers,
    opportunity,
    vessel,
    route,
    hedgeRatio: state.hedgeRatio,
  });
  const finalPnl = result.historicalPnl;
  return (
    <Panel title="Backtest" description="Historical replay from uploaded Baltic, FFA, bunker and physical opportunity rows. Placeholder PnL is disabled.">
      <div className="toolbar">
        <Tag tone={result.status === "OK" ? "good" : "warn"}>{result.status === "OK" ? "Replay calculated" : "Insufficient data"}</Tag>
        <Tag>Hedge ratio: {Math.round(state.hedgeRatio * 100)}%</Tag>
        <Tag>Holding: prompt month</Tag>
      </div>
      {result.status === "INSUFFICIENT_DATA" ? (
        <div className="empty-state">
          <strong>Insufficient data</strong>
          <span>Missing: {result.missingFields.join(", ")}</span>
        </div>
      ) : null}
      <div className="metric-grid four">
        <Metric label="Historical PnL" value={money(finalPnl)} tone={finalPnl > 0 ? "good" : "bad"} />
        <Metric label="Hit rate" value={`${Math.round(result.hitRate * 100)}%`} formula="Winning replay trades / replay trades." />
        <Metric label="Max drawdown" value={money(result.maxDrawdown)} tone="warn" />
        <Metric label="False signals" value={String(result.falseSignalCount)} tone="warn" />
      </div>
      <div className="chart-wrap compact">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={result.equityCurve}>
            <CartesianGrid stroke="#26313d" vertical={false} />
            <XAxis dataKey="date" stroke="#7b8794" tickLine={false} />
            <YAxis stroke="#7b8794" />
            <Tooltip contentStyle={{ background: "#111820", border: "1px solid #26313d", color: "#e8eef5" }} />
            <Line dataKey="cumulativePnl" stroke="#5ec7a4" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="registry-rules">
        <div><b>Replay formula</b><span>{result.formula}</span></div>
        <div><b>Forecast error</b><span>{result.settlementForecastError.toFixed(2)}</span></div>
        <div><b>Route-basis loss</b><span>{money(result.routeBasisLoss)}</span></div>
        <div><b>Sharpe-like metric</b><span>{result.sharpeLike.toFixed(2)}</span></div>
      </div>
    </Panel>
  );
}
