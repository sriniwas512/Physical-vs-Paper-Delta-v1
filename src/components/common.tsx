import type { ReactNode } from "react";
import { cls } from "../lib/format";

export function Panel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cls("panel", className)}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  unit,
  tone = "neutral",
  formula,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "neutral" | "good" | "bad" | "warn";
  formula?: string;
}) {
  return (
    <div className={cls("metric", `metric-${tone}`)} title={formula}>
      <span>{label}</span>
      <strong>{value}</strong>
      {unit ? <small>{unit}</small> : null}
    </div>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "bad" | "warn" }) {
  return <span className={cls("tag", `tag-${tone}`)}>{children}</span>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
