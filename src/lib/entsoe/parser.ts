import { ENTSOE_CONFIG } from '@/config/api';
import {
  PriceDataPoint,
  GenerationDataPoint,
  InstalledCapacity,
  DataSource,
  EnergyType,
} from '@/types/energy';

// ─── Helpers ────────────────────────────────────────────────────────────

function ensureArray<T>(val: T | T[]): T[] {
  return Array.isArray(val) ? val : [val];
}

function mapPsrType(code: string): EnergyType {
  return (ENTSOE_CONFIG.psrTypes[code] as EnergyType) ?? EnergyType.OTHER;
}

/**
 * Compute absolute ISO timestamps from an ENTSO-E TimeSeries period.
 * The period has a start time and a resolution, and each Point has a
 * `position` (1-based index).
 */
function resolveTimestamp(
  periodStart: string,
  resolution: string,
  position: number
): string {
  const start = new Date(periodStart);
  const minutesPerSlot = parseResolutionMinutes(resolution);
  const offsetMs = (position - 1) * minutesPerSlot * 60_000;
  return new Date(start.getTime() + offsetMs).toISOString();
}

function parseResolutionMinutes(resolution: string): number {
  switch (resolution) {
    case 'PT15M': return 15;
    case 'PT30M': return 30;
    case 'PT60M':
    case 'PT1H': return 60;
    case 'P1D': return 1440;
    default: return 60;
  }
}

// ─── Day-Ahead Prices ───────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

export function parseDayAheadPrices(raw: any): PriceDataPoint[] {
  const result: PriceDataPoint[] = [];
  const doc =
    raw?.Publication_MarketDocument ??
    raw?.['Publication_MarketDocument'];

  if (!doc) return result;

  const seriesList = ensureArray(doc.TimeSeries);

  for (const ts of seriesList) {
    const period = ts.Period;
    if (!period) continue;

    const start = period.timeInterval?.start;
    const resolution = period.resolution;
    const points = ensureArray(period.Point);

    for (const pt of points) {
      const pos = parseInt(pt.position, 10);
      result.push({
        timestamp: resolveTimestamp(start, resolution, pos),
        price: parseFloat(pt['price.amount']),
        unit: 'EUR/MWh',
        source: DataSource.ENTSOE,
      });
    }
  }

  return result;
}

// ─── Actual Generation per Type ─────────────────────────────────────────

export function parseActualGeneration(raw: any): GenerationDataPoint[] {
  const result: GenerationDataPoint[] = [];
  const doc =
    raw?.GL_MarketDocument ?? raw?.['GL_MarketDocument'];

  if (!doc) return result;

  const seriesList = ensureArray(doc.TimeSeries);

  for (const ts of seriesList) {
    const psrCode =
      ts.MktPSRType?.psrType ?? ts['MktPSRType']?.['psrType'];
    if (!psrCode) continue;

    const energyType = mapPsrType(psrCode);
    const period = ts.Period;
    if (!period) continue;

    const start = period.timeInterval?.start;
    const resolution = period.resolution;
    const points = ensureArray(period.Point);

    for (const pt of points) {
      const pos = parseInt(pt.position, 10);
      result.push({
        timestamp: resolveTimestamp(start, resolution, pos),
        type: energyType,
        value: parseFloat(pt.quantity),
        unit: 'MW',
        source: DataSource.ENTSOE,
      });
    }
  }

  return result;
}

// ─── Installed Generation Capacity ──────────────────────────────────────

export function parseInstalledCapacity(
  raw: any,
  year: number
): InstalledCapacity[] {
  const result: InstalledCapacity[] = [];
  const doc =
    raw?.GL_MarketDocument ?? raw?.['GL_MarketDocument'];

  if (!doc) return result;

  const seriesList = ensureArray(doc.TimeSeries);

  for (const ts of seriesList) {
    const psrCode =
      ts.MktPSRType?.psrType ?? ts['MktPSRType']?.['psrType'];
    if (!psrCode) continue;

    const energyType = mapPsrType(psrCode);
    const period = ts.Period;
    if (!period) continue;

    const points = ensureArray(period.Point);
    // For installed capacity, we typically have a single point per series
    for (const pt of points) {
      result.push({
        type: energyType,
        capacity: parseFloat(pt.quantity),
        unit: 'MW',
        year,
        source: DataSource.ENTSOE,
      });
    }
  }

  // Aggregate by type (multiple units → sum)
  const aggregated = new Map<EnergyType, InstalledCapacity>();
  for (const cap of result) {
    const existing = aggregated.get(cap.type);
    if (existing) {
      existing.capacity += cap.capacity;
    } else {
      aggregated.set(cap.type, { ...cap });
    }
  }

  return Array.from(aggregated.values());
}

/* eslint-enable @typescript-eslint/no-explicit-any */
