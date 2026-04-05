import { parseStringPromise } from 'xml2js';
import { ENTSOE_CONFIG } from '@/config/api';

const API_KEY = process.env.ENTSOE_API_KEY!;

// ─── Raw API Fetch ──────────────────────────────────────────────────────

interface EntsoeParams {
  documentType: string;
  processType?: string;
  in_Domain?: string;
  out_Domain?: string;
  outBiddingZone_Domain?: string;
  periodStart: string; // YYYYMMDDHHmm
  periodEnd: string;   // YYYYMMDDHHmm
  psrType?: string;
}

/**
 * Build and execute an Entso-E REST API request.
 * Returns the parsed XML as a JS object, or null if no data is available.
 */
export async function fetchEntsoe(params: EntsoeParams): Promise<unknown> {
  let queryString = `documentType=${params.documentType}`;
  if (params.processType) queryString += `&processType=${params.processType}`;
  
  if (params.documentType === ENTSOE_CONFIG.documentTypes.LOAD) {
    const domain = params.outBiddingZone_Domain || ENTSOE_CONFIG.biddingZone;
    queryString += `&outBiddingZone_Domain=${domain}`;
  } else {
    if (params.in_Domain) queryString += `&in_Domain=${params.in_Domain}`;
    if (params.out_Domain) queryString += `&out_Domain=${params.out_Domain}`;
  }

  queryString += `&periodStart=${params.periodStart}`;
  queryString += `&periodEnd=${params.periodEnd}`;
  if (params.psrType) queryString += `&psrType=${params.psrType}`;
  queryString += `&securityToken=${API_KEY}`;

  const fullUrl = `${ENTSOE_CONFIG.baseUrl}?${queryString}`;
  console.log(`[Entso-E] Manual URL: ${fullUrl}`);

  const res = await fetch(fullUrl, {
    headers: { Accept: 'application/xml' },
  });

  const xml = await res.text();
  console.log(`[Entso-E] URL: ${fullUrl}`);
  console.log(`[Entso-E] Raw XML (first 200 chars): ${xml.substring(0, 200)}`);
  
  let parsed: any;
  try {
    parsed = await parseStringPromise(xml, { explicitArray: false });
  } catch (parseErr) {
    console.error('[Entso-E] XML Parsing failed. Raw response:', xml);
    throw parseErr;
  }

  // Entso-E returns 200 even for "no data" — check for Acknowledgement error
  if (parsed?.Acknowledgement_MarketDocument) {
    const reason = parsed.Acknowledgement_MarketDocument?.Reason;
    const code = reason?.code || reason?.[0]?.code;
    const text = reason?.text || reason?.[0]?.text;
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
 * Ensure the end date covers the full last day (periodEnd is exclusive in ENTSO-E).
 * If the date is at midnight, move it to the start of the next day.
 */
function ensureEndOfDay(date: Date): Date {
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  return date;
}

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
    periodEnd: toEntsoeDate(ensureEndOfDay(to)),
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
    periodEnd: toEntsoeDate(ensureEndOfDay(to)),
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
export async function fetchLoad(from: Date, to: Date, biddingZone?: string) {
  return fetchEntsoe({
    documentType: ENTSOE_CONFIG.documentTypes.LOAD,
    processType: ENTSOE_CONFIG.processTypes.REALISED,
    outBiddingZone_Domain: biddingZone || ENTSOE_CONFIG.biddingZone,
    periodStart: toEntsoeDate(from),
    periodEnd: toEntsoeDate(ensureEndOfDay(to)),
  });
}
