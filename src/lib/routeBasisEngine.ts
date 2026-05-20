import type { BalticIndexRow, RiskFlag, RouteBasisResult } from "../types";

export function calculateRouteBasis(input: {
  indexData: BalticIndexRow[];
  physicalExposure: Record<string, number>;
  hedgeIndex: string;
  window?: number;
}): RouteBasisResult {
  const physicalIndex = dominantExposure(input.physicalExposure);
  const rows = alignedSeries(input.indexData, physicalIndex, input.hedgeIndex);
  if (rows.length < 5) {
    return emptyRouteBasis(physicalIndex, input.hedgeIndex, rows.length, "ROUTE_MISMATCH");
  }

  const physicalValues = rows.map((row) => row.physical);
  const hedgeValues = rows.map((row) => row.hedge);
  const spreads = rows.map((row) => row.physical - row.hedge);
  const window = input.window ?? Math.min(20, spreads.length);
  const recent = spreads.slice(-window);
  const spread = spreads.at(-1) ?? 0;
  const rollingMean = mean(recent);
  const rollingStdDev = stdDev(recent);
  const correlation = corr(physicalValues, hedgeValues);
  const beta = variance(hedgeValues) ? covariance(physicalValues, hedgeValues) / variance(hedgeValues) : 0;
  const zScore = rollingStdDev ? (spread - rollingMean) / rollingStdDev : 0;
  const residualBasisRisk = Math.abs(rollingStdDev * (1 - Math.abs(correlation)));
  const directWeight = input.physicalExposure[input.hedgeIndex] ?? 0;
  const confidence = Math.max(0, Math.min(100, rows.length * 2 + Math.abs(correlation) * 50 - residualBasisRisk / 100));

  return {
    physicalIndex,
    hedgeIndex: input.hedgeIndex,
    spread,
    rollingMean,
    rollingStdDev,
    zScore,
    beta,
    correlation,
    recommendedHedgeRatio: Math.max(0, Math.min(1.5, beta || directWeight || 1)),
    residualBasisRisk,
    confidence,
    warning: directWeight < 0.75 && physicalIndex !== input.hedgeIndex ? "ROUTE_MISMATCH" : undefined,
    observations: rows.length,
    formula: `${physicalIndex} minus ${input.hedgeIndex} spread, rolling ${window}-print mean/std-dev, beta = cov(physical, hedge) / var(hedge).`,
  };
}

function alignedSeries(indexData: BalticIndexRow[], physicalIndex: string, hedgeIndex: string) {
  const byDate = new Map<string, Record<string, number>>();
  indexData.forEach((row) => {
    const current = byDate.get(row.date) ?? {};
    current[row.index_code] = row.value;
    byDate.set(row.date, current);
  });
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([date, values]) => {
      const physical = values[physicalIndex];
      const hedge = values[hedgeIndex];
      return typeof physical === "number" && typeof hedge === "number" ? [{ date, physical, hedge }] : [];
    });
}

function dominantExposure(exposure: Record<string, number>): string {
  return Object.entries(exposure).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function emptyRouteBasis(physicalIndex: string, hedgeIndex: string, observations: number, warning: RiskFlag): RouteBasisResult {
  return {
    physicalIndex,
    hedgeIndex,
    spread: 0,
    rollingMean: 0,
    rollingStdDev: 0,
    zScore: 0,
    beta: 0,
    correlation: 0,
    recommendedHedgeRatio: 0,
    residualBasisRisk: 0,
    confidence: 0,
    warning,
    observations,
    formula: "Insufficient aligned history for statistical route-basis model.",
  };
}

const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
const variance = (values: number[]) => {
  const avg = mean(values);
  return mean(values.map((value) => (value - avg) ** 2));
};
const stdDev = (values: number[]) => Math.sqrt(variance(values));
const covariance = (left: number[], right: number[]) => {
  const leftMean = mean(left);
  const rightMean = mean(right);
  return mean(left.map((value, index) => (value - leftMean) * ((right[index] ?? rightMean) - rightMean)));
};
const corr = (left: number[], right: number[]) => {
  const denom = stdDev(left) * stdDev(right);
  return denom ? covariance(left, right) / denom : 0;
};

