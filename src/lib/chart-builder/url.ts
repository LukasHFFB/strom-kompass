import { ChartBuilderState, DatasetConfig, ChartType } from './types';

export function serializeState(state: ChartBuilderState): string {
  const params = new URLSearchParams();

  if (state.datasets.length > 0) {
    const encoded = state.datasets
      .map(d => `${d.sourceId}:${d.yAxis}:${encodeURIComponent(d.color)}`)
      .join(',');
    params.set('d', encoded);
  }

  params.set('t', state.chartType);
  params.set('from', state.from);
  params.set('to', state.to);

  if (state.title) {
    params.set('title', state.title);
  }

  return params.toString();
}

export function deserializeState(search: string): Partial<ChartBuilderState> {
  const params = new URLSearchParams(search);
  const state: Partial<ChartBuilderState> = {};

  const d = params.get('d');
  if (d) {
    state.datasets = d.split(',').map(entry => {
      const [sourceId, yAxis, color] = entry.split(':');
      return {
        sourceId,
        yAxis: (yAxis === 'right' ? 'right' : 'left') as 'left' | 'right',
        color: decodeURIComponent(color || '#2563eb'),
      };
    });
  }

  const t = params.get('t');
  if (t === 'line' || t === 'area') state.chartType = t as ChartType;

  const from = params.get('from');
  if (from) state.from = from;

  const to = params.get('to');
  if (to) state.to = to;

  const title = params.get('title');
  if (title) state.title = title;

  return state;
}

export function getShareUrl(state: ChartBuilderState): string {
  const query = serializeState(state);
  return `${window.location.origin}${window.location.pathname}?${query}`;
}
