// ---- Chart Builder Type System ----

export type ChartType = 'line' | 'area' | 'bar' | 'scatter' | 'heatmap';

export type DataCategory =
  | 'prices'
  | 'generation'
  | 'load'
  | 'forecast'
  | 'market'
  | 'grid'
  | 'curtailment';

export interface DataSourceDef {
  id: string;
  label: string;
  category: DataCategory;
  path: string;
  unit: string;
  /** Key to extract numeric value from API response */
  valueKey: string;
  /** For generation sub-types: filter API response by this energy type */
  energyType?: string;
  /** For NTP endpoints: the endpoint key */
  endpointKey?: string;
}

export interface DatasetConfig {
  sourceId: string;
  color: string;
  yAxis: 'left' | 'right';
}

export type AggPeriod = 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly';
export type AggMethod = 'avg' | 'sum' | 'max' | 'min';

export interface ChartBuilderState {
  datasets: DatasetConfig[];
  chartType: ChartType;
  from: string;
  to: string;
  title: string;
  aggPeriod: AggPeriod;
  aggMethod: AggMethod;
}

export interface NormalizedDataPoint {
  timestamp: string;
  value: number;
}

export interface ChartDataset {
  id: string;
  label: string;
  data: NormalizedDataPoint[];
  color: string;
  yAxis: 'left' | 'right';
  unit: string;
}

// Color palette for datasets
export const PALETTE = [
  '#2563eb', // blue
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
];
