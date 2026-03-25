import {
  PriceDataPoint,
  GenerationDataPoint,
  InstalledCapacity,
  ForecastDataPoint,
  EnergyDataResponse,
  DataSource,
  EnergyType,
} from '@/types/energy';
import { getCached, setCache, buildCacheKey, CACHE_TTL } from './cache';

// Entso-E
import {
  fetchDayAheadPrices,
  fetchActualGeneration,
  fetchInstalledCapacity,
} from '@/lib/entsoe/client';
import {
  parseDayAheadPrices,
  parseActualGeneration,
  parseInstalledCapacity,
} from '@/lib/entsoe/parser';

// Netztransparenz
import {
  fetchSpotMarketPrices,
  fetchSolarProjection,
  fetchWindProjection,
} from '@/lib/netztransparenz/client';
import {
  parseSpotMarketPrices,
  parseProjection,
} from '@/lib/netztransparenz/parser';

// Persistence
import {
  queryPriceData,
  upsertPriceData,
  queryGenerationData,
  upsertGenerationData,
  queryForecastData,
  upsertForecastData,
  queryCapacityData,
  upsertCapacityData,
} from './persistence';

// ─── Price Data ─────────────────────────────────────────────────────────

export async function getConsolidatedPrices(
  from: Date,
  to: Date
): Promise<EnergyDataResponse<PriceDataPoint>> {
  const key = buildCacheKey(['prices', from.toISOString(), to.toISOString()]);
  const cached = getCached<PriceDataPoint[]>(key);
  if (cached) {
    return wrapResponse(cached, DataSource.ENTSOE, from, to);
  }

  // 1. Try DB first
  const dbData = await queryPriceData(from, to, DataSource.ENTSOE);
  if (dbData.length > 0) {
    return wrapResponse(dbData, DataSource.ENTSOE, from, to);
  }

  // 2. Fallback to API
  const raw = await fetchDayAheadPrices(from, to);
  const data = raw ? parseDayAheadPrices(raw) : [];

  if (data.length > 0) {
    await upsertPriceData(data);
  }

  setCache(key, data, CACHE_TTL.PRICES);
  return wrapResponse(data, DataSource.ENTSOE, from, to);
}

// ─── Generation Mix ─────────────────────────────────────────────────────

export async function getGenerationMix(
  from: Date,
  to: Date
): Promise<EnergyDataResponse<GenerationDataPoint>> {
  const key = buildCacheKey(['generation', from.toISOString(), to.toISOString()]);
  const cached = getCached<GenerationDataPoint[]>(key);
  if (cached) {
    return wrapResponse(cached, DataSource.ENTSOE, from, to);
  }

  // 1. Try DB first
  const dbData = await queryGenerationData(from, to, DataSource.ENTSOE);
  if (dbData.length > 0) {
    return wrapResponse(dbData, DataSource.ENTSOE, from, to);
  }

  // 2. Fallback to API
  const raw = await fetchActualGeneration(from, to);
  const data = raw ? parseActualGeneration(raw) : [];

  if (data.length > 0) {
    await upsertGenerationData(data);
  }

  setCache(key, data, CACHE_TTL.GENERATION);
  return wrapResponse(data, DataSource.ENTSOE, from, to);
}

// ─── Installed Capacity ─────────────────────────────────────────────────

export async function getInstalledCapacityData(
  year: number
): Promise<EnergyDataResponse<InstalledCapacity>> {
  const key = buildCacheKey(['capacity', String(year)]);
  const cached = getCached<InstalledCapacity[]>(key);
  if (cached) {
    return wrapResponse(
      cached,
      DataSource.ENTSOE,
      new Date(year, 0, 1),
      new Date(year, 11, 31)
    );
  }

  // 1. Try DB first
  const dbData = await queryCapacityData(year, DataSource.ENTSOE);
  if (dbData.length > 0) {
    return wrapResponse(
      dbData,
      DataSource.ENTSOE,
      new Date(year, 0, 1),
      new Date(year, 11, 31)
    );
  }

  // 2. Fallback to API
  const raw = await fetchInstalledCapacity(year);
  const data = raw ? parseInstalledCapacity(raw, year) : [];

  if (data.length > 0) {
    await upsertCapacityData(data);
  }

  setCache(key, data, CACHE_TTL.CAPACITY);
  return wrapResponse(
    data,
    DataSource.ENTSOE,
    new Date(year, 0, 1),
    new Date(year, 11, 31)
  );
}

// ─── Spot Market Prices (Netztransparenz) ───────────────────────────────

export async function getMarketValues(
  from: Date,
  to: Date
): Promise<EnergyDataResponse<PriceDataPoint>> {
  const key = buildCacheKey(['spotprices', from.toISOString(), to.toISOString()]);
  const cached = getCached<PriceDataPoint[]>(key);
  if (cached) {
    return wrapResponse(cached, DataSource.NETZTRANSPARENZ, from, to);
  }

  // 1. Try DB first
  const dbData = await queryPriceData(from, to, DataSource.NETZTRANSPARENZ);
  if (dbData.length > 0) {
    return wrapResponse(dbData, DataSource.NETZTRANSPARENZ, from, to);
  }

  // 2. Fallback to API
  const csv = await fetchSpotMarketPrices(from, to);
  const data = parseSpotMarketPrices(csv);

  if (data.length > 0) {
    await upsertPriceData(data);
  }

  setCache(key, data, CACHE_TTL.MARKET_VALUES);
  return wrapResponse(data, DataSource.NETZTRANSPARENZ, from, to);
}

// ─── Forecasts (Netztransparenz) ────────────────────────────────────────

export async function getForecasts(
  type: 'solar' | 'wind',
  from: Date,
  to: Date
): Promise<EnergyDataResponse<ForecastDataPoint>> {
  const key = buildCacheKey(['forecast', type, from.toISOString(), to.toISOString()]);
  const cached = getCached<ForecastDataPoint[]>(key);
  if (cached) {
    return wrapResponse(cached, DataSource.NETZTRANSPARENZ, from, to);
  }

  const energyType =
    type === 'solar' ? EnergyType.SOLAR : EnergyType.WIND_ONSHORE;

  // 1. Try DB first
  const dbData = await queryForecastData(from, to, energyType, DataSource.NETZTRANSPARENZ);
  if (dbData.length > 0) {
    return wrapResponse(dbData, DataSource.NETZTRANSPARENZ, from, to);
  }

  // 2. Fallback to API
  const csv =
    type === 'solar'
      ? await fetchSolarProjection(from, to)
      : await fetchWindProjection(from, to);

  const data = parseProjection(csv, energyType);

  if (data.length > 0) {
    await upsertForecastData(data);
  }

  setCache(key, data, CACHE_TTL.FORECASTS);
  return wrapResponse(data, DataSource.NETZTRANSPARENZ, from, to);
}

// ─── Helpers ────────────────────────────────────────────────────────────

function wrapResponse<T>(
  data: T[],
  source: DataSource,
  from: Date,
  to: Date
): EnergyDataResponse<T> {
  return {
    data,
    meta: {
      source,
      from: from.toISOString(),
      to: to.toISOString(),
      fetchedAt: new Date().toISOString(),
      count: data.length,
    },
  };
}
