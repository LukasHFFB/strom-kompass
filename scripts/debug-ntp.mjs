// End-to-end test: fetch NTP data → run through our parser → show results
const BASE = 'https://ds.netztransparenz.de/api/v1/data';
const TOKEN_URL = 'https://identity.netztransparenz.de/users/connect/token';
const CLIENT_ID = 'cm_app_ntp_id_de17f703dd504ba58382489f1e845304';
const CLIENT_SECRET = 'ntp_T61GobzQp7BgCRzwlODB';

async function getToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json();
  return json.access_token;
}

// Replicate exact parser logic from src/lib/netztransparenz/parser.ts
function parseCSV(rawCsv) {
  let csv = rawCsv.trim();
  if (csv.startsWith('"') && csv.endsWith('"')) {
    csv = csv.slice(1, -1);
  }
  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return [];

  const separator = ';';
  const headers = lines[0].replace(/^"/, '').replace(/"$/, '').split(separator).map(h => h.trim().replace(/"/g, ''));

  return lines.slice(1).map((line) => {
    const values = line.split(separator).map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

function parseGermanNumber(str) {
  if (str.includes(',')) return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  return parseFloat(str);
}

async function main() {
  const token = await getToken();
  console.log('✓ Token obtained\n');

  // Test 1: Spot Market Prices
  console.log('=== SPOT MARKET PRICES ===');
  const res1 = await fetch(`${BASE}/Spotmarktpreise/2025-03-01/2025-03-02`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv, application/json' },
  });
  const csv1 = await res1.text();
  const rows1 = parseCSV(csv1);
  console.log(`Status: ${res1.status}, Parsed rows: ${rows1.length}`);
  if (rows1.length > 0) {
    console.log('First row:', JSON.stringify(rows1[0]));
    const price = parseGermanNumber(rows1[0]['Spotmarktpreis in ct/kWh']);
    console.log(`Price: ${price} ct/kWh = ${price * 10} EUR/MWh`);
  }

  // Test 2: Solar Projection  
  console.log('\n=== SOLAR PROJECTION ===');
  const res2 = await fetch(`${BASE}/hochrechnung/Solar/2025-03-01/2025-03-02`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv, application/json' },
  });
  const csv2 = await res2.text();
  const rows2 = parseCSV(csv2);
  console.log(`Status: ${res2.status}, Parsed rows: ${rows2.length}`);
  if (rows2.length > 0) {
    console.log('First row:', JSON.stringify(rows2[0]));
    // Sum TSOs
    const tsos = ['50Hertz (MW)', 'Amprion (MW)', 'TenneT TSO (MW)', 'TransnetBW (MW)'];
    let total = 0;
    for (const tso of tsos) {
      const val = rows2[0][tso];
      if (val && val !== 'N.A.') total += parseGermanNumber(val);
    }
    console.log(`Total generation: ${total} MW`);
  }

  // Test 3: Wind Projection
  console.log('\n=== WIND PROJECTION ===');
  const res3 = await fetch(`${BASE}/hochrechnung/Wind/2025-03-01/2025-03-02`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv, application/json' },
  });
  const csv3 = await res3.text();
  const rows3 = parseCSV(csv3);
  console.log(`Status: ${res3.status}, Parsed rows: ${rows3.length}`);
  if (rows3.length > 0) {
    console.log('First row:', JSON.stringify(rows3[0]));
    const tsos = ['50Hertz (MW)', 'Amprion (MW)', 'TenneT TSO (MW)', 'TransnetBW (MW)'];
    let total = 0;
    for (const tso of tsos) {
      const val = rows3[0][tso];
      if (val && val !== 'N.A.') total += parseGermanNumber(val);
    }
    console.log(`Total generation: ${total} MW`);
  }
  
  // Test 4: Marketing EPEX
  console.log('\n=== MARKETING EPEX ===');
  const res4 = await fetch(`${BASE}/vermarktung/VermarktungEpex/2025-03-01/2025-03-02`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv, application/json' },
  });
  const csv4 = await res4.text();
  const rows4 = parseCSV(csv4);
  console.log(`Status: ${res4.status}, Parsed rows: ${rows4.length}`);
  if (rows4.length > 0) console.log('First row:', JSON.stringify(rows4[0]));
}

main().catch(console.error);
