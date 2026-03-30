import { ChartType, DatasetConfig } from './types';
import { getSourceById } from './sources';

export interface ChartTypeOption {
  id: ChartType;
  label: string;
  description: string;
}

export const CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { id: 'line', label: 'Linie', description: 'Zeitverläufe vergleichen' },
  { id: 'area', label: 'Fläche', description: 'Gefüllte Zeitverläufe' },
];

export function getCompatibleChartTypes(datasets: DatasetConfig[]): ChartType[] {
  if (datasets.length === 0) return ['line', 'area'];
  // All current sources are timeseries, so both line and area always work
  return ['line', 'area'];
}

export function isChartTypeCompatible(chartType: ChartType, datasets: DatasetConfig[]): boolean {
  return getCompatibleChartTypes(datasets).includes(chartType);
}
