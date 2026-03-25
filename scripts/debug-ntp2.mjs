import { writeFileSync } from 'fs';

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

async function main() {
  const token = await getToken();
  const url = `${BASE}/Spotmarktpreise/2025-03-01/2025-03-02`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const csv = await res.text();
  
  console.log('Raw length:', csv.length);
  console.log('First 20 chars:', JSON.stringify(csv.substring(0, 20)));
  console.log('Last 20 chars:', JSON.stringify(csv.substring(csv.length - 20)));
  
  let processed = csv.trim();
  console.log('After trim starts with quote?', processed.startsWith('"'));
  console.log('After trim ends with quote?', processed.endsWith('"'));
  
  if (processed.startsWith('"') && processed.endsWith('"')) {
    processed = processed.slice(1, -1);
  }
  
  const lines = processed.split('\n');
  console.log('Split by \\n lines count:', lines.length);
  
  const lines2 = processed.replace(/\\r\\n/g, '\n').replace(/\\r/g, '\n').split('\n');
  console.log('Split by regex \\r\\n lines count:', lines2.length);

  const lines3 = processed.split(/\r?\n/);
  console.log('Split by /\\r?\\n/ lines count:', lines3.length);

  console.log('First few lines after split:');
  console.log(lines3.slice(0, 3));
}

main().catch(console.error);
