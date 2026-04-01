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
  if (rows.length === 0) {
    console.log('[parseMarketValues] No CSV rows parsed. Raw length:', csv.length);
    return [];
  }

  const headers = Object.keys(rows[0]);
  console.log('[parseMarketValues] CSV columns:', headers.join(', '));

  // Flexible column detection — match by known names first, then by substring
  const dateCol =
    headers.find(h => /^(Datum|Monat|Date|Jahr|Year|Abrechnungsmonat)$/i.test(h)) ||
    headers.find(h => /datum|date|monat|jahr|year/i.test(h));

  const valueCol =
    headers.find(h => /^(Marktwert|MarketValue|Wert|Value|Marktpr.mie|Jahresmarktwert|Monatsmarktwert)$/i.test(h)) ||
    headers.find(h => /wert|value|pr.mie|praemie/i.test(h));

  const techCol =
    headers.find(h => /^(Technologie|Technology|Energietr.ger)$/i.test(h)) ||
    headers.find(h => /technolog|energietr/i.test(h));

  // Detect unit from value column header (e.g. "Marktwert (ct/kWh)")
  let unit = 'EUR/MWh';
  let convertCtToEur = false;
  if (valueCol) {
    const unitMatch = valueCol.match(/\(([^)]+)\)/);
    if (unitMatch) {
      const rawUnit = unitMatch[1].toLowerCase();
      if (rawUnit.includes('ct/kwh')) {
        convertCtToEur = true; // ct/kWh → EUR/MWh (* 10)
      } else if (rawUnit.includes('eur/mwh')) {
        unit = 'EUR/MWh';
      } else {
        unit = unitMatch[1];
      }
    }
  }

  if (!dateCol || !valueCol) {
    console.log(`[parseMarketValues] Could not find required columns. dateCol=${dateCol}, valueCol=${valueCol}. Headers: ${headers.join('; ')}`);
    return [];
  }

  console.log(`[parseMarketValues] Using: date="${dateCol}", value="${valueCol}", tech="${techCol || 'none'}"`);

  const result: MarketValue[] = [];
  for (const row of rows) {
    const dateStr = row[dateCol] ?? '';
    const valueStr = row[valueCol] ?? '';
    const techStr = techCol ? (row[techCol] ?? '') : '';

    if (!dateStr || !valueStr) continue;

    const energyType = mapTechnologyToEnergyType(techStr);
    let value = parseGermanNumber(valueStr);
    if (convertCtToEur) value = value * 10;

    result.push({
      timestamp: parseFlexibleDate(dateStr),
      type: energyType,
      value: Math.round(value * 100) / 100,
      unit,
      source: DataSource.NETZTRANSPARENZ,
    });
  }

  return result;
}

// ─── Annual Market Value Parser (pivoted: years as columns) ─────────────

export function parseAnnualMarketValues(csv: string): MarketValue[] {
  const rows = parseCSV(csv);
  if (rows.length === 0) {
    console.log('[parseAnnualMarketValues] No CSV rows parsed');
    return [];
  }

  const headers = Object.keys(rows[0]);
  // Year columns are 4-digit numbers; the remaining column is the label
  const yearCols = headers.filter(h => /^\d{4}$/.test(h)).sort();
  const labelCol = headers.find(h => !/^\d{4}$/.test(h));

  if (yearCols.length === 0 || !labelCol) {
    console.log('[parseAnnualMarketValues] No year columns found. Headers:', headers.join(', '));
    return [];
  }

  // Detect unit from label column header (e.g. "Alle Werte in ct/kWh")
  const isCtKwh = labelCol.toLowerCase().includes('ct/kwh');

  console.log(`[parseAnnualMarketValues] labelCol="${labelCol}", years=${yearCols.join(',')}, isCtKwh=${isCtKwh}`);

  const result: MarketValue[] = [];

  for (const row of rows) {
    const techStr = (row[labelCol] ?? '').trim();
    if (!techStr) continue;
    const energyType = mapTechnologyToEnergyType(techStr);

    for (const year of yearCols) {
      const valueStr = row[year] ?? '';
      if (!valueStr) continue;

      let value = parseGermanNumber(valueStr);
      if (isNaN(value)) continue;
      if (isCtKwh) value = value * 10; // ct/kWh → EUR/MWh

      result.push({
        timestamp: `${year}-01-01T00:00:00.000Z`,
        type: energyType,
        value: Math.round(value * 100) / 100,
        unit: 'EUR/MWh',
        source: DataSource.NETZTRANSPARENZ,
      });
    }
  }

  return result;
}

// ─── Generic NTP Parser ─────────────────────────────────────────────────

export function parseGenericNtp(csv: string): any[] {
  const rows = parseCSV(csv);
  if (rows.length === 0) {
    console.log('[parseGenericNtp] No CSV rows parsed. Raw length:', csv.length, '| First 300 chars:', csv.substring(0, 300));
    return [];
  }
  console.log('[parseGenericNtp] CSV columns:', Object.keys(rows[0]).join(', '), '| Rows:', rows.length);

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
  if (t.includes('offshore') || t.includes('auf see')) return EnergyType.WIND_OFFSHORE;
  if (t.includes('wind') || t.includes('an land')) return EnergyType.WIND_ONSHORE;
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
  // yyyy-MM (month only, e.g. from Monatsmarktwerte)
  if (/^\d{4}-\d{2}$/.test(str)) {
    return `${str}-01T00:00:00.000Z`;
  }
  // MM.yyyy (German month format)
  const match3 = str.match(/^(\d{2})\.(\d{4})$/);
  if (match3) {
    const [, mm, yyyy] = match3;
    return `${yyyy}-${mm}-01T00:00:00.000Z`;
  }
  // yyyy (year only, e.g. from Jahresmarktwerte)
  if (/^\d{4}$/.test(str)) {
    return `${str}-01-01T00:00:00.000Z`;
  }
  return new Date(str).toISOString();
}
