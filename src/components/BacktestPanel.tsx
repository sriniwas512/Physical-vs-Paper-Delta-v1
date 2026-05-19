import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { money } from "../lib/format";
import { Panel, Metric, Tag } from "./common";

const pnl = Array.from({ length: 18 }, (_, index) => ({
  week: `W${index + 1}`,
  pnl: Math.round(120000 * Math.sin(index / 2.8) + index * 38000 - (index > 10 ? 90000 : 0)),
}));

export function BacktestPanel() {
  const finalPnl = pnl.at(-1)?.pnl ?? 0;
  return (
    <Panel title="Backtest" description="MVP deterministic strategy replay over uploaded history with transparent rule knobs.">
      <div className="toolbar">
        <Tag>Ship basis threshold: 500 $/day</Tag>
        <Tag>Paper edge threshold: 300 $/day</Tag>
        <Tag>Holding: prompt month</Tag>
      </div>
      <div className="metric-grid four">
        <Metric label="Historical PnL" value={money(finalPnl)} tone={finalPnl > 0 ? "good" : "bad"} />
        <Metric label="Hit rate" value="61%" />
        <Metric label="Max drawdown" value={money(142000)} tone="warn" />
        <Metric label="False signals" value="3" tone="warn" />
      </div>
      <div className="chart-wrap compact">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={pnl}>
            <CartesianGrid stroke="#26313d" vertical={false} />
            <XAxis dataKey="week" stroke="#7b8794" tickLine={false} />
            <YAxis stroke="#7b8794" />
            <Tooltip contentStyle={{ background: "#111820", border: "1px solid #26313d", color: "#e8eef5" }} />
            <Line dataKey="pnl" stroke="#5ec7a4" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
