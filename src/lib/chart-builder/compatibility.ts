import { ChartType, DatasetConfig } from './types';

export interface ChartTypeOption {
  id: ChartType;
  label: string;
  description: string;
}

export const CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { id: 'line', label: 'Linie', description: 'Zeitverläufe vergleichen' },
  { id: 'area', label: 'Fläche', description: 'Gefüllte Zeitverläufe' },
  { id: 'bar', label: 'Balken', description: 'Werte als Balken' },
  { id: 'scatter', label: 'Streudiagramm', description: 'Korrelation (2 Datensätze)' },
  { id: 'heatmap', label: 'Heatmap', description: 'Muster nach Stunde & Tag' },
];

/**
 * Return which chart types are available given the current dataset selection.
 */
export function getCompatibleChartTypes(datasets: DatasetConfig[]): ChartType[] {
  const n = datasets.length;
  if (n === 0) return ['line', 'area', 'bar', 'scatter', 'heatmap'];

  const types: ChartType[] = ['line', 'area', 'bar'];

  // Scatter requires exactly 2 datasets
  if (n === 2) types.push('scatter');

  // Heatmap requires exactly 1 dataset
  if (n === 1) types.push('heatmap');

  return types;
}

export function isChartTypeCompatible(chartType: ChartType, datasets: DatasetConfig[]): boolean {
  return getCompatibleChartTypes(datasets).includes(chartType);
}
