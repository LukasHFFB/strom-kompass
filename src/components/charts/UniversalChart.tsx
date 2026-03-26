'use client';

import PriceLineChart, { PricePoint } from './PriceLineChart';
import GenerationStackedArea from './GenerationStackedArea';
import CapacityBarChart from './CapacityBarChart';

// ─── Chart Compatibility ─────────────────────────────────────────────────
// Maps source category → valid chart types (first entry = default for that source)

export type ChartType = 'line' | 'area' | 'bar';

export const CHART_COMPAT: Record<string, ChartType[]> = {
  prices:     ['line', 'area'],
  generation: ['area'],
  load:       ['line', 'area'],
  capacity:   ['bar'],
  ntp:        ['line', 'area'],
};

/** Map a sourceId to its CHART_COMPAT category key */
export function getSourceCategory(sourceId: string): string {
  if (sourceId.startsWith('ntp_')) return 'ntp';
  return sourceId;
}

// ─── Data Normalization ──────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Normalize any time-series data shape to PricePoint for line/area charts.
 * Handles: PriceDataPoint (.price), LoadDataPoint (.value),
 *          NTP generic (.value), ForecastDataPoint (.forecast).
 */
function normalizeToPricePoints(data: any[]): PricePoint[] {
  return data
    .map((d) => ({
      timestamp: String(d.timestamp ?? ''),
      price: Number(d.price ?? d.value ?? d.forecast ?? 0),
      unit: String(d.unit ?? ''),
      source: String(d.source ?? ''),
    }))
    .filter((d) => d.timestamp !== '' && !isNaN(d.price));
}

// ─── Component ───────────────────────────────────────────────────────────

interface UniversalChartProps {
  type: ChartType;
  data: any[];
  height?: number;
  sourceId: string;
}

export default function UniversalChart({
  type,
  data,
  height = 400,
  sourceId,
}: UniversalChartProps) {
  const category = getSourceCategory(sourceId);
  const validTypes = CHART_COMPAT[category] ?? CHART_COMPAT.ntp;

  // If requested type is not valid for this source, fall back to the source's default
  const effectiveType: ChartType = validTypes.includes(type) ? type : validTypes[0];
  void effectiveType; // reserved for future line vs area visual distinction

  if (category === 'generation') {
    return <GenerationStackedArea data={data} height={height} />;
  }

  if (category === 'capacity') {
    return <CapacityBarChart data={data} height={height} />;
  }

  // prices, load, and all NTP sources: normalize to time-value and render
  return <PriceLineChart data={normalizeToPricePoints(data)} height={height} />;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
