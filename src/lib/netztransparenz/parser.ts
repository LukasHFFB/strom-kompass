import {
  MarketValue,
  ForecastDataPoint,
  PriceDataPoint,
  DataSource,
  EnergyType,
} from '@/types/energy';

// ─── CSV Parsing Utility ────────────────────────────────────────────────

function parseCSV(rawCsv: string): Record<string, string>[] {
  // Netztransparenz wraps the entire CSV body in outer double quotes — strip them
  let csv = rawCsv.trim();
  if (csv.startsWith('"') && csv.endsWith('"')) {
    csv = csv.slice(1, -1);
  }

  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return [];

  // Netztransparenz uses ';' as separator and wraps header row in quotes sometimes
  const separator = ';';
  const headers = lines[0]
    .replace(/^"/, '')
    .replace(/"$/, '')
    .split(separator)
    .map((h) => h.trim().replace(/"/g, ''));

  return lines.slice(1).map((line) => {
    const values = line.split(separator).map((v) => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });
}

// ─── Spot Market Price Parser ───────────────────────────────────────────
// Format: "Datum;von;Zeitzone von;bis;Zeitzone bis;Spotmarktpreis in ct/kWh"

export function parseSpotMarketPrices(csv: string): PriceDataPoint[] {
  const rows = parseCSV(csv);
  const result: PriceDataPoint[] = [];

  for (const row of rows) {
    const datum = row['Datum'] ?? '';
    const von = row['von'] ?? '';
    const priceStr = row['Spotmarktpreis in ct/kWh'] ?? '';

    if (!datum || !priceStr) continue;

    const timestamp = buildTimestamp(datum, von);
    const priceCtKwh = parseGermanNumber(priceStr);
    const priceEurMwh = priceCtKwh * 10; // ct/kWh → EUR/MWh

    result.push({
      timestamp,
      price: Math.round(priceEurMwh * 100) / 100,
      unit: 'EUR/MWh',
      source: DataSource.NETZTRANSPARENZ,
    });
  }

  return result;
}

// ─── Projection / Hochrechnung Parser ───────────────────────────────────
// Format: "Datum;von;Zeitzone von;bis;Zeitzone bis;50Hertz (MW);Amprion (MW);TenneT TSO (MW);TransnetBW (MW)"

export function parseProjection(
  csv: string,
  type: EnergyType
): ForecastDataPoint[] {
  const rows = parseCSV(csv);
  const result: ForecastDataPoint[] = [];

  for (const row of rows) {
    const datum = row['Datum'] ?? '';
    const von = row['von'] ?? '';

    // Sum up all TSO values
    const tsos = ['50Hertz (MW)', 'Amprion (MW)', 'TenneT TSO (MW)', 'TransnetBW (MW)'];
    let total = 0;
    let hasValue = false;

    for (const tso of tsos) {
      const val = row[tso];
      if (val && val !== 'N.A.' && val !== '') {
        total += parseGermanNumber(val);
        hasValue = true;
      }
    }

    if (!datum || !hasValue) continue;

    result.push({
      timestamp: buildTimestamp(datum, von),
      type,
      forecast: Math.round(total * 100) / 100,
      unit: 'MW',
      source: DataSource.NETZTRANSPARENZ,
    });
  }

  return result;
}

// ─── Market Value Parser (fallback / generic) ───────────────────────────

export function parseMarketValues(csv: string): MarketValue[] {
  const rows = parseCSV(csv);
  const result: MarketValue[] = [];

  for (const row of rows) {
    const dateStr = row['Datum'] ?? row['Monat'] ?? row['Date'] ?? '';
    const techStr = row['Technologie'] ?? row['Technology'] ?? '';
    const valueStr =
      row['Marktwert'] ?? row['MarketValue'] ?? row['Wert'] ?? '';

    if (!dateStr || !valueStr) continue;

    const energyType = mapTechnologyToEnergyType(techStr);
    const value = parseGermanNumber(valueStr);

    result.push({
      timestamp: parseFlexibleDate(dateStr),
      type: energyType,
      value,
      unit: 'EUR/MWh',
      source: DataSource.NETZTRANSPARENZ,
    });
  }

  return result;
}

// ─── Generic NTP Parser ─────────────────────────────────────────────────

export function parseGenericNtp(csv: string): any[] {
  const rows = parseCSV(csv);
  const result: any[] = [];

  for (const row of rows) {
    const datum = row['Datum'] ?? row['Monat'] ?? row['Date'] ?? '';
    const von = row['von'] ?? '';
    
    if (!datum) continue;

    const timestamp = buildTimestamp(datum, von);
    
    // Sum all numeric value columns, skip metadata fields.
    // For multi-TSO data (e.g. 50Hertz/Amprion/TenneT/TransnetBW columns)
    // this produces the Germany-wide total, consistent with other parsers.
    let value = 0;
    let unit = 'N/A';
    let hasValue = false;

    const SKIP_KEYS = new Set(['Datum', 'von', 'bis', 'Zeitzone von', 'Zeitzone bis', 'Monat', 'Date']);

    for (const [key, val] of Object.entries(row)) {
      if (SKIP_KEYS.has(key)) continue;
      const num = parseGermanNumber(val);
      if (!isNaN(num)) {
        value += num;
        hasValue = true;
        // Extract unit from first matching header, e.g. "Solar (MW)" → "MW"
        if (unit === 'N/A') {
          const unitMatch = key.match(/\(([^)]+)\)/);
          if (unitMatch) unit = unitMatch[1];
        }
      }
    }

    if (!hasValue) continue;

    result.push({
      timestamp,
      value: Math.round(value * 100) / 100,
      unit,
      source: DataSource.NETZTRANSPARENZ,
    });
  }

  return result;
}

// Keep old export name for compatibility
export const parseForecast = parseProjection;

// ─── Helpers ────────────────────────────────────────────────────────────

function mapTechnologyToEnergyType(tech: string): EnergyType {
  const t = tech.toLowerCase();
  if (t.includes('solar') || t.includes('pv')) return EnergyType.SOLAR;
  if (t.includes('offshore')) return EnergyType.WIND_OFFSHORE;
  if (t.includes('wind')) return EnergyType.WIND_ONSHORE;
  if (t.includes('biomass') || t.includes('biomasse')) return EnergyType.BIOMASS;
  if (t.includes('wasser') || t.includes('hydro')) return EnergyType.HYDRO;
  return EnergyType.OTHER_RENEWABLE;
}

function parseGermanNumber(str: string): number {
  if (!str || typeof str !== 'string') return NaN;
  // German format: 1.234,56 → 1234.56
  // Also handle simple format: 12.038
  if (str.includes(',')) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(str);
}

/**
 * Build ISO timestamp from Datum + von fields.
 * Datum formats: "dd.MM.yyyy" or "yyyy-MM-dd" or "dd.MM.yyyy HH:mm"
 * von format: "HH:mm"
 */
function buildTimestamp(datum: string, von?: string): string {
  const dateStr = parseFlexibleDate(datum);
  if (von && von.match(/^\d{2}:\d{2}$/)) {
    // Replace the time portion
    return dateStr.replace('T00:00:00.000Z', `T${von}:00.000Z`);
  }
  return dateStr;
}

function parseFlexibleDate(str: string): string {
  // dd.MM.yyyy HH:mm
  const match1 = str.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
  if (match1) {
    const [, dd, mm, yyyy, hh, min] = match1;
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:00.000Z`;
  }
  // dd.MM.yyyy
  const match2 = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match2) {
    const [, dd, mm, yyyy] = match2;
    return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
  }
  // yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return `${str}T00:00:00.000Z`;
  }
  return new Date(str).toISOString();
}
