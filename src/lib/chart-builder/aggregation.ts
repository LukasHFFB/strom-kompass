import type { NormalizedDataPoint } from './types';

export type AggPeriod = 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly';
export type AggMethod = 'avg' | 'sum' | 'max' | 'min';

export const AGG_PERIOD_OPTIONS: { id: AggPeriod; label: string }[] = [
  { id: 'none', label: 'Rohdaten' },
  { id: 'hourly', label: 'Stündlich' },
  { id: 'daily', label: 'Täglich' },
  { id: 'weekly', label: 'Wöchentlich' },
  { id: 'monthly', label: 'Monatlich' },
];

export const AGG_METHOD_OPTIONS: { id: AggMethod; label: string }[] = [
  { id: 'avg', label: 'Durchschnitt' },
  { id: 'sum', label: 'Summe' },
  { id: 'max', label: 'Maximum' },
  { id: 'min', label: 'Minimum' },
];

/**
 * Compute the bucket key for a given timestamp and period.
 */
function bucketKey(ts: string, period: AggPeriod): string {
  const d = new Date(ts);
  switch (period) {
    case 'hourly': {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const h = String(d.getUTCHours()).padStart(2, '0');
      return `${y}-${m}-${day}T${h}:00:00.000Z`;
    }
    case 'daily': {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}T00:00:00.000Z`;
    }
    case 'weekly': {
      // Monday-based week: rewind to Monday
      const day = d.getUTCDay();
      const diff = day === 0 ? 6 : day - 1; // Mon = 0 offset
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - diff);
      monday.setUTCHours(0, 0, 0, 0);
      return monday.toISOString();
    }
    case 'monthly': {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${y}-${m}-01T00:00:00.000Z`;
    }
    default:
      return ts;
  }
}

/**
 * Aggregate data points into period buckets using the specified method.
 */
export function aggregateData(
  data: NormalizedDataPoint[],
  period: AggPeriod,
  method: AggMethod,
): NormalizedDataPoint[] {
  if (period === 'none' || data.length === 0) return data;

  // Group into buckets
  const buckets = new Map<string, number[]>();
  for (const point of data) {
    const key = bucketKey(point.timestamp, period);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(point.value);
  }

  // Apply aggregation method
  const result: NormalizedDataPoint[] = [];
  for (const [timestamp, values] of buckets) {
    let value: number;
    switch (method) {
      case 'sum':
        value = values.reduce((a, b) => a + b, 0);
        break;
      case 'max':
        value = Math.max(...values);
        break;
      case 'min':
        value = Math.min(...values);
        break;
      case 'avg':
      default:
        value = values.reduce((a, b) => a + b, 0) / values.length;
        break;
    }
    result.push({ timestamp, value: Math.round(value * 100) / 100 });
  }

  return result.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
