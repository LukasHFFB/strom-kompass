import { DataSourceDef, DataCategory } from './types';
import { EnergyType } from '@/types/energy';
import { NTP_CONFIG } from '@/config/api';

// ---- Category metadata ----

export const CATEGORY_LABELS: Record<DataCategory, string> = {
  prices: 'Preise & Markt',
  generation: 'Erzeugung',
  load: 'Last & Verbrauch',
  forecast: 'Prognosen',
  market: 'Vermarktung',
  grid: 'Netz & Regelenergie',
  curtailment: 'Einspeise & EEG',
};

export const CATEGORY_ORDER: DataCategory[] = [
  'prices', 'generation', 'load', 'forecast', 'market', 'grid', 'curtailment',
];

// ---- Generation sub-types ----

const GENERATION_TYPES: { type: EnergyType; label: string }[] = [
  { type: EnergyType.SOLAR, label: 'Solar' },
  { type: EnergyType.WIND_ONSHORE, label: 'Wind Onshore' },
  { type: EnergyType.WIND_OFFSHORE, label: 'Wind Offshore' },
  { type: EnergyType.BIOMASS, label: 'Biomasse' },
  { type: EnergyType.HYDRO, label: 'Wasserkraft' },
  { type: EnergyType.GAS, label: 'Erdgas' },
  { type: EnergyType.HARD_COAL, label: 'Steinkohle' },
  { type: EnergyType.LIGNITE, label: 'Braunkohle' },
  { type: EnergyType.NUCLEAR, label: 'Kernenergie' },
];

// ---- Core Entso-E sources ----

const CORE_SOURCES: DataSourceDef[] = [
  {
    id: 'prices',
    label: 'Börsenstrompreise (Day-Ahead)',
    category: 'prices',
    path: '/api/energy/prices',
    unit: 'EUR/MWh',
    valueKey: 'price',
  },
  {
    id: 'load',
    label: 'Stromverbrauch (Netzlast)',
    category: 'load',
    path: '/api/energy/load',
    unit: 'MW',
    valueKey: 'value',
  },
  ...GENERATION_TYPES.map(({ type, label }): DataSourceDef => ({
    id: `gen_${type}`,
    label: `${label}`,
    category: 'generation',
    path: '/api/energy/generation',
    unit: 'MW',
    valueKey: 'value',
    energyType: type,
  })),
];

// ---- NTP sources ----

function getNtpCategory(key: string): DataCategory {
  if (/PROJECTION|FORECAST|ONLINE/.test(key)) return 'forecast';
  if (/SPOT|NEGATIVE|ID_AEP/.test(key)) return 'prices';
  if (/MARKET|ANNUAL_MARKET|MONTHLY_MARKET/.test(key)) return 'prices';
  if (/MARKETING|DIFF_FEED|BALANCING|INTRADAY/.test(key)) return 'market';
  if (/CURTAILMENT|ABSM|PRODUCTION_BAN|EEG/.test(key)) return 'curtailment';
  return 'grid'; // everything else (NRV, reserves, redispatch, etc.)
}

const NTP_LABELS: Record<string, string> = {
  WIND_PROJECTION: 'Wind Hochrechnung',
  SOLAR_PROJECTION: 'Solar Hochrechnung',
  ONLINE_WIND_ONSHORE: 'Wind Onshore (Online)',
  ONLINE_WIND_OFFSHORE: 'Wind Offshore (Online)',
  ONLINE_SOLAR: 'Solar (Online)',
  WIND_FORECAST: 'Windprognose',
  SOLAR_FORECAST: 'Solarprognose',
  ANNUAL_MARKET_VALUES: 'Jahresmarktwerte',
  MONTHLY_MARKET_VALUES: 'Monatsmarktwerte',
  SPOT_MARKET_PRICE: 'Spotmarktpreise',
  NEGATIVE_PRICES_1H: 'Negative Preise (1h)',
  NEGATIVE_PRICES_3H: 'Negative Preise (3h)',
  NEGATIVE_PRICES_4H: 'Negative Preise (4h)',
  NEGATIVE_PRICES_6H: 'Negative Preise (6h)',
  ID_AEP: 'Intraday AEP',
  DIFF_FEED_IN_FORECAST: 'Differenz Einspeiseprognose',
  BALANCING_ENERGY_USAGE: 'Ausgleichsenergie',
  INTRADAY_VOLUMES: 'Untertägige Strommengen',
  MARKETING_EPEX: 'Vermarktung EPEX',
  MARKETING_EXAA: 'Vermarktung EXAA',
  MARKETING_SOLAR: 'Vermarktung Solar',
  MARKETING_WIND: 'Vermarktung Wind',
  MARKETING_OTHER: 'Vermarktung Sonstige',
  REDISPATCH: 'Redispatch',
  CAPACITY_RESERVE: 'Kapazitätsreserve',
  GCC_TRAFFIC_LIGHT: 'Ampelsystem',
  DESIGNATED_CURTAILMENT: 'Ausgewiesene ABSM',
  ALLOCATED_CURTAILMENT: 'Zugeteilte ABSM',
  PRODUCTION_BANS: 'Erzeugungsverbot',
  EEG_NEGATIVE_PRICES: 'EEG Vergütungsanspruch',
};

function getNtpLabel(key: string): string {
  return NTP_LABELS[key] || key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

const NTP_SOURCES: DataSourceDef[] = Object.keys(NTP_CONFIG.endpoints).map(key => ({
  id: `ntp_${key}`,
  label: getNtpLabel(key),
  category: getNtpCategory(key),
  path: `/api/energy/data?endpoint=${key}`,
  unit: '',
  valueKey: 'value',
  endpointKey: key,
}));

// ---- Exports ----

export const ALL_SOURCES: DataSourceDef[] = [...CORE_SOURCES, ...NTP_SOURCES];

export function getSourceById(id: string): DataSourceDef | undefined {
  return ALL_SOURCES.find(s => s.id === id);
}

export function getSourcesByCategory(): Map<DataCategory, DataSourceDef[]> {
  const map = new Map<DataCategory, DataSourceDef[]>();
  for (const cat of CATEGORY_ORDER) {
    map.set(cat, []);
  }
  for (const source of ALL_SOURCES) {
    const list = map.get(source.category);
    if (list) list.push(source);
  }
  for (const [cat, sources] of map) {
    if (sources.length === 0) map.delete(cat);
  }
  return map;
}
