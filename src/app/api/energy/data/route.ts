import { NextRequest, NextResponse } from 'next/server';
import { fetchNtpEndpoint } from '@/lib/netztransparenz/client';
import {
  parseGenericNtp,
  parseMarketValues,
  parseAnnualMarketValues,
  parseMonthlyMarketValues,
  parseSpotMarketPrices,
  parseProjection,
} from '@/lib/netztransparenz/parser';
import { NTP_CONFIG } from '@/config/api';
import { EnergyType } from '@/types/energy';

// ── Endpoint → parser routing ────────────────────────────────────────────

// (no set needed — MONTHLY handled inline below)

const SPOT_ENDPOINTS = new Set(['SPOT_MARKET_PRICE']);

const PROJECTION_TYPE_MAP: Record<string, EnergyType> = {
  WIND_PROJECTION: EnergyType.WIND_ONSHORE,
  SOLAR_PROJECTION: EnergyType.SOLAR,
  ONLINE_WIND_ONSHORE: EnergyType.WIND_ONSHORE,
  ONLINE_WIND_OFFSHORE: EnergyType.WIND_OFFSHORE,
  ONLINE_SOLAR: EnergyType.SOLAR,
  WIND_FORECAST: EnergyType.WIND_ONSHORE,
  SOLAR_FORECAST: EnergyType.SOLAR,
};

function parseEndpointData(endpointKey: string, csv: string): any[] {
  if (endpointKey === 'ANNUAL_MARKET_VALUES') {
    return parseAnnualMarketValues(csv).map(mv => ({
      timestamp: mv.timestamp,
      value: mv.value,
      unit: mv.unit || 'EUR/MWh',
      source: String(mv.source),
      type: mv.type,
    }));
  }

  if (endpointKey === 'MONTHLY_MARKET_VALUES') {
    return parseMonthlyMarketValues(csv).map(mv => ({
      timestamp: mv.timestamp,
      value: mv.value,
      unit: mv.unit || 'EUR/MWh',
      source: String(mv.source),
      type: mv.type,
    }));
  }

  if (SPOT_ENDPOINTS.has(endpointKey)) {
    return parseSpotMarketPrices(csv).map(p => ({
      timestamp: p.timestamp,
      value: p.price,
      unit: p.unit,
      source: String(p.source),
    }));
  }

  if (endpointKey in PROJECTION_TYPE_MAP) {
    return parseProjection(csv, PROJECTION_TYPE_MAP[endpointKey]).map(f => ({
      timestamp: f.timestamp,
      value: f.forecast,
      unit: f.unit,
      source: String(f.source),
    }));
  }

  return parseGenericNtp(csv);
}

// ── Route handler ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpointKey = searchParams.get('endpoint');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!endpointKey || !from || !to) {
    return NextResponse.json({ error: 'Missing parameters (endpoint, from, to)' }, { status: 400 });
  }

  const endpoint = (NTP_CONFIG.endpoints as any)[endpointKey];
  if (!endpoint) {
    return NextResponse.json({ error: 'Invalid endpoint: ' + endpointKey }, { status: 400 });
  }

  try {
    const dateFrom = new Date(from);
    const dateTo = new Date(to);

    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const rawCsv = await fetchNtpEndpoint(endpoint, dateFrom, dateTo);
    console.log(`[API-DATA] ${endpointKey}: response length=${rawCsv.length}, first 200 chars: ${rawCsv.substring(0, 200)}`);
    const data = parseEndpointData(endpointKey, rawCsv);
    console.log(`[API-DATA] ${endpointKey}: parsed ${data.length} records`);

    return NextResponse.json({
      meta: {
        count: data.length,
        endpoint: endpointKey,
        from,
        to,
      },
      data,
    });
  } catch (error: any) {
    console.error(`[API-DATA] Error fetching ${endpointKey}:`, error);
    return NextResponse.json({ error: error.message || 'Failed to fetch NTP data' }, { status: 500 });
  }
}
