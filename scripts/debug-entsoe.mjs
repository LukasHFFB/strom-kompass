// Debug: test multiple bidding zones
const { writeFileSync } = await import('fs');
const API_KEY = '2584eb0d-5563-4922-bc10-0eafb0f97261';
const BASE = 'https://web-api.tp.entsoe.eu/api';

const zones = [
  ['10Y1001A1001A83!', 'DE-LU (83)'],
  ['10Y1001A1001A82!', 'DE-AT-LU (82)'],  
  ['10YDE-RWENET---I', 'DE (Amprion)'],
  ['10Y1001A1001A63L', 'DE-LU BZN'],
];

for (const [zone, label] of zones) {
  const params = new URLSearchParams({
    securityToken: API_KEY,
    documentType: 'A44',
    processType: 'A01',
    in_Domain: zone,
    out_Domain: zone,
    periodStart: '202503200000',
    periodEnd: '202503210000',
  });

  const url = `${BASE}?${params}`;
  console.log(`\n=== ${label} ===`);

  try {
    const res = await fetch(url);
    const text = await res.text();
    const hasData = text.includes('TimeSeries');
    const hasError = text.includes('Acknowledgement');
    console.log(`Status: ${res.status} | HasData: ${hasData} | HasError: ${hasError}`);
    if (hasError) {
      const match = text.match(/<text>(.*?)<\/text>/);
      console.log('Error:', match?.[1] ?? 'unknown');
    }
    if (hasData) {
      writeFileSync(`/tmp/entsoe-${zone.replace(/[^a-zA-Z0-9]/g, '')}.xml`, text);
      console.log('✓ Saved!');
    }
  } catch (e) {
    console.log('Fetch error:', e.message);
  }
}
