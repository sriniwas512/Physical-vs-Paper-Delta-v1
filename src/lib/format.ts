export const money = (value: number, unit = "$", maximumFractionDigits = 0) =>
  `${unit}${new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value)}`;

export const number = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);

export const rate = (value: number, unit: string) => `${number(value, unit === "$/mt" ? 2 : 0)} ${unit}`;

export const pct = (value: number) => `${Math.round(value * 100)}%`;

export const cls = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");
