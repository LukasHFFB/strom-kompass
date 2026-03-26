import { prisma } from './db';
import {
  PriceDataPoint,
  GenerationDataPoint,
  ForecastDataPoint,
  InstalledCapacity,
  DataSource,
  EnergyType,
} from '@/types/energy';

/**
 * Upsert price data points.
 * Uses individual upserts with Promise.allSettled to avoid transaction timeouts on remote DBs.
 */
export async function upsertPriceData(data: PriceDataPoint[]) {
  if (data.length === 0) return;

  const results = await Promise.allSettled(
    data.map((point) =>
      prisma.priceData.upsert({
        where: {
          timestamp_source: {
            timestamp: new Date(point.timestamp),
            source: point.source,
          },
        },
        update: {
          price: point.price,
        },
        create: {
          timestamp: new Date(point.timestamp),
          price: point.price,
          source: point.source,
        },
      })
    )
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(`[upsertPriceData] ${failed.length}/${data.length} upserts failed`);
  }
}

/**
 * Upsert generation data points.
 */
export async function upsertGenerationData(data: GenerationDataPoint[]) {
  if (data.length === 0) return;

  const results = await Promise.allSettled(
    data.map((point) =>
      prisma.generationData.upsert({
        where: {
          timestamp_energyType_source: {
            timestamp: new Date(point.timestamp),
            energyType: point.type,
            source: point.source,
          },
        },
        update: {
          value: point.value,
        },
        create: {
          timestamp: new Date(point.timestamp),
          energyType: point.type,
          value: point.value,
          source: point.source,
        },
      })
    )
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(`[upsertGenerationData] ${failed.length}/${data.length} upserts failed`);
  }
}

/**
 * Upsert forecast data points.
 */
export async function upsertForecastData(data: ForecastDataPoint[]) {
  if (data.length === 0) return;

  const results = await Promise.allSettled(
    data.map((point) =>
      prisma.forecastData.upsert({
        where: {
          timestamp_forecastType_energyType_source: {
            timestamp: new Date(point.timestamp),
            forecastType: 'projection',
            energyType: point.type,
            source: point.source,
          },
        },
        update: {
          value: point.forecast,
        },
        create: {
          timestamp: new Date(point.timestamp),
          forecastType: 'projection',
          energyType: point.type,
          value: point.forecast,
          source: point.source,
        },
      })
    )
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(`[upsertForecastData] ${failed.length}/${data.length} upserts failed`);
  }
}

/**
 * Upsert capacity data.
 */
export async function upsertCapacityData(data: InstalledCapacity[]) {
  if (data.length === 0) return;

  const results = await Promise.allSettled(
    data.map((point) =>
      prisma.capacityData.upsert({
        where: {
          date_energyType_source: {
            date: new Date(point.year, 0, 1),
            energyType: point.type,
            source: point.source,
          },
        },
        update: {
          value: point.capacity,
        },
        create: {
          date: new Date(point.year, 0, 1),
          energyType: point.type,
          value: point.capacity,
          source: point.source,
        },
      })
    )
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(`[upsertCapacityData] ${failed.length}/${data.length} upserts failed`);
  }
}

/**
 * Query price data from DB.
 */
export async function queryPriceData(from: Date, to: Date, source?: DataSource): Promise<PriceDataPoint[]> {
  const records = await prisma.priceData.findMany({
    where: {
      timestamp: {
        gte: from,
        lte: to,
      },
      ...(source ? { source } : {}),
    },
    orderBy: { timestamp: 'asc' },
  });

  return records.map(r => ({
    timestamp: r.timestamp.toISOString(),
    price: r.price,
    unit: 'EUR/MWh',
    source: r.source as DataSource,
  }));
}

/**
 * Query generation data from DB.
 */
export async function queryGenerationData(from: Date, to: Date, source?: DataSource): Promise<GenerationDataPoint[]> {
  const records = await prisma.generationData.findMany({
    where: {
      timestamp: {
        gte: from,
        lte: to,
      },
      ...(source ? { source } : {}),
    },
    orderBy: { timestamp: 'asc' },
  });

  return records.map(r => ({
    timestamp: r.timestamp.toISOString(),
    type: r.energyType as EnergyType,
    value: r.value,
    unit: 'MW',
    source: r.source as DataSource,
  }));
}

/**
 * Query forecast data from DB.
 */
export async function queryForecastData(from: Date, to: Date, energyType?: string, source?: DataSource): Promise<ForecastDataPoint[]> {
  const records = await prisma.forecastData.findMany({
    where: {
      timestamp: {
        gte: from,
        lte: to,
      },
      ...(energyType ? { energyType } : {}),
      ...(source ? { source } : {}),
    },
    orderBy: { timestamp: 'asc' },
  });

  return records.map(r => ({
    timestamp: r.timestamp.toISOString(),
    type: r.energyType as EnergyType,
    forecast: r.value,
    unit: 'MW',
    source: r.source as DataSource,
  }));
}

/**
 * Query capacity data from DB.
 */
export async function queryCapacityData(year: number, source?: DataSource): Promise<InstalledCapacity[]> {
  const records = await prisma.capacityData.findMany({
    where: {
      date: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31),
      },
      ...(source ? { source } : {}),
    },
  });

  return records.map(r => ({
    type: r.energyType as EnergyType,
    capacity: r.value,
    unit: 'MW',
    year,
    source: r.source as DataSource,
  }));
}
