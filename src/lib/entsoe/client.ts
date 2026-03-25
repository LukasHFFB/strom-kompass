import { parseStringPromise } from 'xml2js';
import { ENTSOE_CONFIG } from '@/config/api';

const API_KEY = process.env.ENTSOE_API_KEY!;

// ─── Raw API Fetch ──────────────────────────────────────────────────────

interface EntsoeParams {
  documentType: string;
  processType?: string;
  in_Domain?: string;
  out_Domain?: string;
  periodStart: string; // YYYYMMDDHHmm
  periodEnd: string;   // YYYYMMDDHHmm
  psrType?: string;
}

/**
 * Build and execute an Entso-E REST API request.
 * Returns the parsed XML as a JS object, or null if no data is available.
 */
export async function fetchEntsoe(params: EntsoeParams): Promise<unknown> {
  const url = new URL(ENTSOE_CONFIG.baseUrl);
  url.searchParams.set('securityToken', API_KEY);
  url.searchParams.set('documentType', params.documentType);

  if (params.processType) url.searchParams.set('processType', params.processType);
  if (params.in_Domain) url.searchParams.set('in_Domain', params.in_Domain);
  if (params.out_Domain) url.searchParams.set('out_Domain', params.out_Domain);
  url.searchParams.set('periodStart', params.periodStart);
  url.searchParams.set('periodEnd', params.periodEnd);
  if (params.psrType) url.searchParams.set('psrType', params.psrType);

  console.log(`[Entso-E] Fetching: documentType=${params.documentType} periodStart=${params.periodStart} periodEnd=${params.periodEnd}`);

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/xml' },
  });

  const xml = await res.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false });

  // Entso-E returns 200 even for "no data" — check for Acknowledgement error
  if (parsed?.Acknowledgement_MarketDocument) {
    const reason = parsed.Acknowledgement_MarketDocument?.Reason;
    const code = reason?.code;
    const text = reason?.text;
    console.log(`[Entso-E] Acknowledgement: code=${code}, text=${text}`);
    // Code 999 = "No matching data found"
    if (code === '999') return null;
    throw new Error(`Entso-E error (${code}): ${text}`);
  }

  if (!res.ok) {
    throw new Error(`Entso-E API error ${res.status}: ${xml.substring(0, 500)}`);
  }

  return parsed;
}

// ─── Convenience helpers ────────────────────────────────────────────────

/**
 * Format a Date as YYYYMMDDHHmm in UTC for the Entso-E API.
 */
function toEntsoeDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  return `${y}${m}${d}${h}${min}`;
}

/**
 * Fetch day-ahead prices for Germany.
 */
export async function fetchDayAheadPrices(from: Date, to: Date) {
  return fetchEntsoe({
    documentType: ENTSOE_CONFIG.documentTypes.DAY_AHEAD_PRICES,
    processType: ENTSOE_CONFIG.processTypes.DAY_AHEAD,
    in_Domain: ENTSOE_CONFIG.biddingZone,
    out_Domain: ENTSOE_CONFIG.biddingZone,
    periodStart: toEntsoeDate(from),
    periodEnd: toEntsoeDate(to),
  });
}

/**
 * Fetch actual generation per type.
 */
export async function fetchActualGeneration(from: Date, to: Date) {
  return fetchEntsoe({
    documentType: ENTSOE_CONFIG.documentTypes.ACTUAL_GENERATION,
    processType: ENTSOE_CONFIG.processTypes.REALISED,
    in_Domain: ENTSOE_CONFIG.biddingZone,
    periodStart: toEntsoeDate(from),
    periodEnd: toEntsoeDate(to),
  });
}

/**
 * Fetch installed generation capacity per unit.
 */
export async function fetchInstalledCapacity(year: number) {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year, 11, 31, 23, 0));
  return fetchEntsoe({
    documentType: ENTSOE_CONFIG.documentTypes.INSTALLED_CAPACITY,
    processType: ENTSOE_CONFIG.processTypes.YEAR_AHEAD,
    in_Domain: ENTSOE_CONFIG.biddingZone,
    periodStart: toEntsoeDate(from),
    periodEnd: toEntsoeDate(to),
  });
}

/**
 * Fetch actual total load.
 */
export async function fetchLoad(from: Date, to: Date) {
  return fetchEntsoe({
    documentType: ENTSOE_CONFIG.documentTypes.LOAD,
    processType: ENTSOE_CONFIG.processTypes.REALISED,
    in_Domain: ENTSOE_CONFIG.biddingZone,
    periodStart: toEntsoeDate(from),
    periodEnd: toEntsoeDate(to),
  });
}
