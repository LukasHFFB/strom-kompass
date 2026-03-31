import { EnergyType } from '@/types/energy';

// ─── Entso-E Configuration ──────────────────────────────────────────────

export const ENTSOE_CONFIG = {
  baseUrl: 'https://web-api.tp.entsoe.eu/api',
  biddingZone: '10Y1001A1001A82H', // DE-LU

  documentTypes: {
    DAY_AHEAD_PRICES: 'A44',
    ACTUAL_GENERATION: 'A75',
    INSTALLED_CAPACITY: 'A68',
    SCHEDULED_EXCHANGE: 'A11',
    WIND_SOLAR_FORECAST: 'A69',
    ACTUAL_GENERATION_WIND_SOLAR: 'A74',
    LOAD: 'A65',
    LOAD_FORECAST: 'A65',
  },

  processTypes: {
    DAY_AHEAD: 'A01',
    INTRADAY: 'A02',
    REALISED: 'A16',
    YEAR_AHEAD: 'A33',
  },

  psrTypes: {
    B01: EnergyType.BIOMASS,
    B02: EnergyType.LIGNITE,
    B04: EnergyType.GAS,
    B05: EnergyType.HARD_COAL,
    B06: EnergyType.OIL,
    B09: EnergyType.GEOTHERMAL,
    B10: EnergyType.HYDRO_PUMPED,
    B11: EnergyType.HYDRO,
    B12: EnergyType.HYDRO,
    B14: EnergyType.NUCLEAR,
    B15: EnergyType.OTHER_RENEWABLE,
    B16: EnergyType.SOLAR,
    B17: EnergyType.WASTE,
    B18: EnergyType.WIND_OFFSHORE,
    B19: EnergyType.WIND_ONSHORE,
    B20: EnergyType.OTHER,
  } as Record<string, EnergyType>,
} as const;

// ─── Netztransparenz Configuration ──────────────────────────────────────

export const NTP_CONFIG = {
  tokenUrl: 'https://identity.netztransparenz.de/users/connect/token',
  baseUrl: 'https://ds.netztransparenz.de/api/v1/data',

  /**
   * Complete endpoint catalog.
   * URL pattern: {baseUrl}/{data}/{product}/{dateFrom}/{dateTo}
   * When product is 'n/e', omit the product segment.
   */
  endpoints: {
    // ── Projections & Forecasts ────────────────────────────────────────
    WIND_PROJECTION:            { data: 'hochrechnung',        product: 'Wind' },
    SOLAR_PROJECTION:           { data: 'hochrechnung',        product: 'Solar' },
    ONLINE_WIND_ONSHORE:        { data: 'OnlineHochrechnung',  product: 'Windonshore' },
    ONLINE_WIND_OFFSHORE:       { data: 'OnlineHochrechnung',  product: 'Windoffshore' },
    ONLINE_SOLAR:               { data: 'OnlineHochrechnung',  product: 'Solar' },
    WIND_FORECAST:              { data: 'prognose',            product: 'Wind' },
    SOLAR_FORECAST:             { data: 'prognose',            product: 'Solar' },

    // ── Market Values & Prices ────────────────────────────────────────
    ANNUAL_MARKET_VALUES:       { data: 'Jahresmarktpraemie',  product: null },
    MONTHLY_MARKET_VALUES:      { data: 'marktpraemie',        product: null },
    SPOT_MARKET_PRICE:          { data: 'Spotmarktpreise',     product: null },
    NEGATIVE_PRICES_1H:         { data: 'NegativePreise',      product: '1' },
    NEGATIVE_PRICES_3H:         { data: 'NegativePreise',      product: '3' },
    NEGATIVE_PRICES_4H:         { data: 'NegativePreise',      product: '4' },
    NEGATIVE_PRICES_6H:         { data: 'NegativePreise',      product: '6' },
    ID_AEP:                     { data: 'IdAep',               product: null },

    // ── Marketing / Vermarktung ───────────────────────────────────────
    DIFF_FEED_IN_FORECAST:      { data: 'vermarktung',         product: 'DifferenzEinspeiseprognose' },
    BALANCING_ENERGY_USAGE:     { data: 'vermarktung',         product: 'InanspruchnahmeAusgleichsenergie' },
    INTRADAY_VOLUMES:           { data: 'vermarktung',         product: 'UntertaegigeStrommengen' },
    MARKETING_EPEX:             { data: 'vermarktung',         product: 'VermarktungEpex' },
    MARKETING_EXAA:             { data: 'vermarktung',         product: 'VermarktungExaa' },
    MARKETING_SOLAR:            { data: 'vermarktung',         product: 'VermarktungsSolar' },
    MARKETING_WIND:             { data: 'vermarktung',         product: 'VermarktungsWind' },
    MARKETING_OTHER:            { data: 'vermarktung',         product: 'VermarktungsSonstige' },

    // ── Grid / NRV Saldo ──────────────────────────────────────────────
    GCC_BALANCE_OPERATIONAL:    { data: 'nrvsaldo/NRVSaldo',         product: 'Betrieblich' },
    GCC_BALANCE_QA:             { data: 'nrvsaldo/NRVSaldo',         product: 'Qualitaetsgesichert' },
    LFC_BALANCE_OPERATIONAL:    { data: 'nrvsaldo/RZSaldo',          product: 'Betrieblich' },
    LFC_BALANCE_QA:             { data: 'nrvsaldo/RZSaldo',          product: 'Qualitaetsgesichert' },
    AFRR_ACTIVATED_OP:          { data: 'nrvsaldo/AktivierteSRL',    product: 'Betrieblich' },
    AFRR_ACTIVATED_QA:          { data: 'nrvsaldo/AktivierteSRL',    product: 'Qualitaetsgesichert' },
    MFRR_ACTIVATED_OP:          { data: 'nrvsaldo/AktivierteMRL',    product: 'Betrieblich' },
    MFRR_ACTIVATED_QA:          { data: 'nrvsaldo/AktivierteMRL',    product: 'Qualitaetsgesichert' },
    AFRR_OPTIMIZATION_OP:       { data: 'nrvsaldo/SRLOptimierung',   product: 'Betrieblich' },
    AFRR_OPTIMIZATION_QA:       { data: 'nrvsaldo/SRLOptimierung',   product: 'Qualitaetsgesichert' },
    MFRR_OPTIMIZATION_OP:       { data: 'nrvsaldo/MRLOptimierung',   product: 'Betrieblich' },
    MFRR_OPTIMIZATION_QA:       { data: 'nrvsaldo/MRLOptimierung',   product: 'Qualitaetsgesichert' },
    PRL_OPERATIONAL:            { data: 'nrvsaldo/PRL',              product: 'Betrieblich' },
    PRL_QA:                     { data: 'nrvsaldo/PRL',              product: 'Qualitaetsgesichert' },
    DIFFERENCE_OP:              { data: 'nrvsaldo/Difference',       product: 'Betrieblich' },
    DIFFERENCE_QA:              { data: 'nrvsaldo/Difference',       product: 'Qualitaetsgesichert' },
    ADDITIONAL_MEASURES_OP:     { data: 'nrvsaldo/Zusatzmassnahmen', product: 'Betrieblich' },
    ADDITIONAL_MEASURES_QA:     { data: 'nrvsaldo/Zusatzmassnahmen', product: 'Qualitaetsgesichert' },
    EMERGENCY_AID_ABROAD:       { data: 'nrvsaldo/Nothilfe',        product: 'Qualitaetsgesichert' },
    REBAP_DEFICIT:              { data: 'nrvsaldo/reBAP',            product: 'Qualitaetsgesichert' },
    REBAP_SURPLUS:              { data: 'nrvsaldo/reBAP',            product: 'Qualitaetsgesichert' },
    AEP_MODULE_1:               { data: 'nrvsaldo/AEPModule',        product: 'Qualitaetsgesichert' },
    AEP_MODULE_2:               { data: 'nrvsaldo/AEPModule',        product: 'Qualitaetsgesichert' },
    AEP_MODULE_3:               { data: 'nrvsaldo/AEPModule',        product: 'Qualitaetsgesichert' },
    FIN_IMPACT_AEP_1:           { data: 'nrvsaldo/FinanzielleWirkungAEPModule', product: 'Qualitaetsgesichert' },
    FIN_IMPACT_AEP_2:           { data: 'nrvsaldo/FinanzielleWirkungAEPModule', product: 'Qualitaetsgesichert' },
    FIN_IMPACT_AEP_3:           { data: 'nrvsaldo/FinanzielleWirkungAEPModule', product: 'Qualitaetsgesichert' },
    AEP_ESTIMATOR:              { data: 'nrvsaldo/AepSchaetzer',     product: 'Betrieblich' },
    VOAA:                       { data: 'nrvsaldo/VoAA',             product: 'Qualitaetsgesichert' },
    SHEDDABLE_LOADS_OP:         { data: 'nrvsaldo/AbschaltbareLasten', product: 'Betrieblich' },
    SHEDDABLE_LOADS_QA:         { data: 'nrvsaldo/AbschaltbareLasten', product: 'Qualitaetsgesichert' },
    MOL_DEVIATIONS:             { data: 'nrvsaldo/MrlMolAbweichungen', product: 'Betrieblich' },
    SRL_MOL_DEVIATIONS:         { data: 'nrvsaldo/SrlMolAbweichungen', product: 'Betrieblich' },

    // ── Curtailment / EEG ─────────────────────────────────────────────
    DESIGNATED_CURTAILMENT:     { data: 'ausgewieseneABSM',   product: null },
    ALLOCATED_CURTAILMENT:      { data: 'zugeteilteABSM',     product: null },
    PRODUCTION_BANS:            { data: 'erzeugungsverbot',    product: null },
    EEG_NEGATIVE_PRICES:        { data: 'Anspruchverguetungeeg', product: null },

    // ── Redispatch & Reserves ─────────────────────────────────────────
    REDISPATCH:                 { data: 'Redispatch',          product: null },
    CAPACITY_RESERVE:           { data: 'Kapazitaetsreserve',  product: null },
    GCC_TRAFFIC_LIGHT:          { data: 'TrafficLight',        product: null },
  },
} as const;

// ─── URL pattern overrides per endpoint data path ───────────────────────

export type NtpUrlPattern = 'standard' | 'month-year' | 'no-dates';

/**
 * Endpoints whose URL structure differs from the standard
 * {data}/{product?}/{dateFrom}/{dateTo} pattern.
 *
 * - 'no-dates':   /data/Jahresmarktpraemie              (no date segments)
 * - 'month-year': /data/marktpraemie/{mF}/{yF}/{mT}/{yT} (month/year ints)
 */
export const NTP_URL_PATTERNS: Record<string, NtpUrlPattern> = {
  Jahresmarktpraemie: 'no-dates',
  marktpraemie: 'month-year',
};

// ─── Helper to build NTP URL ────────────────────────────────────────────

function formatStandardDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function buildNtpUrl(
  endpoint: { data: string; product: string | null },
  dateFrom: Date,
  dateTo: Date
): string {
  const pattern = NTP_URL_PATTERNS[endpoint.data] || 'standard';
  const base = `${NTP_CONFIG.baseUrl}/${endpoint.data}`;

  if (pattern === 'no-dates') {
    return base;
  }

  if (pattern === 'month-year') {
    return `${base}/${dateFrom.getMonth() + 1}/${dateFrom.getFullYear()}/${dateTo.getMonth() + 1}/${dateTo.getFullYear()}`;
  }

  // standard: {data}/{product?}/{yyyy-MM-dd}/{yyyy-MM-dd}
  const from = formatStandardDate(dateFrom);
  const to = formatStandardDate(dateTo);
  if (endpoint.product) {
    return `${base}/${endpoint.product}/${from}/${to}`;
  }
  return `${base}/${from}/${to}`;
}

// ─── Cache TTL (seconds) ────────────────────────────────────────────────

export const CACHE_TTL = {
  PRICES: 60 * 60,
  GENERATION: 60 * 15,
  CAPACITY: 60 * 60 * 24,
  MARKET_VALUES: 60 * 60,
  FORECASTS: 60 * 15,
} as const;
