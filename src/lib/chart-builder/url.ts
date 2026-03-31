import { ChartBuilderState, ChartType, AggPeriod, AggMethod, DisplayType } from './types';

const VALID_CHART_TYPES = new Set(['line', 'area', 'bar', 'scatter', 'heatmap']);
const VALID_AGG_PERIODS = new Set(['none', 'hourly', 'daily', 'weekly', 'monthly']);
const VALID_AGG_METHODS = new Set(['avg', 'sum', 'max', 'min']);
const VALID_DISPLAY_TYPES = new Set(['line', 'area', 'bar']);

export function serializeState(state: ChartBuilderState): string {
  const params = new URLSearchParams();

  if (state.datasets.length > 0) {
    // Format: sourceId:yAxis:color:displayType
    const encoded = state.datasets
      .map(d => `${d.sourceId}:${d.yAxis}:${encodeURIComponent(d.color)}:${d.displayType}`)
      .join(',');
    params.set('d', encoded);
  }

  params.set('t', state.chartType);
  params.set('from', state.from);
  params.set('to', state.to);

  if (state.title) params.set('title', state.title);
  if (state.aggPeriod && state.aggPeriod !== 'none') params.set('agg', state.aggPeriod);
  if (state.aggMethod && state.aggMethod !== 'avg') params.set('aggm', state.aggMethod);

  return params.toString();
}

export function deserializeState(search: string): Partial<ChartBuilderState> {
  const params = new URLSearchParams(search);
  const state: Partial<ChartBuilderState> = {};

  const d = params.get('d');
  if (d) {
    state.datasets = d.split(',').map(entry => {
      const parts = entry.split(':');
      const [sourceId, yAxis, color, displayType] = parts;
      return {
        sourceId,
        yAxis: (yAxis === 'right' ? 'right' : 'left') as 'left' | 'right',
        color: decodeURIComponent(color || '#2563eb'),
        displayType: (VALID_DISPLAY_TYPES.has(displayType) ? displayType : 'line') as DisplayType,
      };
    });
  }

  const t = params.get('t');
  if (t && VALID_CHART_TYPES.has(t)) state.chartType = t as ChartType;

  const from = params.get('from');
  if (from) state.from = from;

  const to = params.get('to');
  if (to) state.to = to;

  const title = params.get('title');
  if (title) state.title = title;

  const agg = params.get('agg');
  if (agg && VALID_AGG_PERIODS.has(agg)) state.aggPeriod = agg as AggPeriod;

  const aggm = params.get('aggm');
  if (aggm && VALID_AGG_METHODS.has(aggm)) state.aggMethod = aggm as AggMethod;

  return state;
}

export function getShareUrl(state: ChartBuilderState): string {
  const query = serializeState(state);
  return `${window.location.origin}${window.location.pathname}?${query}`;
}
