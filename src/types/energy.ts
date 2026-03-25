// ─── Data Source Identifiers ────────────────────────────────────────────

export enum DataSource {
  ENTSOE = 'entsoe',
  NETZTRANSPARENZ = 'netztransparenz',
  BNETZA = 'bnetza',
}

// ─── Energy Type Enum ───────────────────────────────────────────────────

export enum EnergyType {
  SOLAR = 'solar',
  WIND_ONSHORE = 'wind_onshore',
  WIND_OFFSHORE = 'wind_offshore',
  BIOMASS = 'biomass',
  HYDRO = 'hydro',
  HYDRO_PUMPED = 'hydro_pumped',
  GAS = 'gas',
  HARD_COAL = 'hard_coal',
  LIGNITE = 'lignite',
  NUCLEAR = 'nuclear',
  OIL = 'oil',
  GEOTHERMAL = 'geothermal',
  WASTE = 'waste',
  OTHER = 'other',
  OTHER_RENEWABLE = 'other_renewable',
}

// ─── Core Data Point Interfaces ─────────────────────────────────────────

export interface PriceDataPoint {
  timestamp: string; // ISO 8601
  price: number;     // EUR/MWh
  unit: string;
  source: DataSource;
}

export interface GenerationDataPoint {
  timestamp: string; // ISO 8601
  type: EnergyType;
  value: number;     // MW
  unit: string;
  source: DataSource;
}

export interface InstalledCapacity {
  type: EnergyType;
  capacity: number; // MW
  unit: string;
  year: number;
  source: DataSource;
}

export interface MarketValue {
  timestamp: string; // ISO 8601 (typically monthly)
  type: EnergyType;
  value: number;     // EUR/MWh
  unit: string;
  source: DataSource;
}

export interface ForecastDataPoint {
  timestamp: string; // ISO 8601
  type: EnergyType;
  forecast: number;  // MW
  actual?: number;   // MW (if available)
  unit: string;
  source: DataSource;
}

// ─── API Response Wrappers ──────────────────────────────────────────────

export interface EnergyDataResponse<T> {
  data: T[];
  meta: {
    source: DataSource;
    from: string;
    to: string;
    fetchedAt: string;
    count: number;
  };
}

// ─── Resolution / Granularity ───────────────────────────────────────────

export type Resolution = 'PT15M' | 'PT30M' | 'PT60M' | 'P1D' | 'P1M' | 'P1Y';
