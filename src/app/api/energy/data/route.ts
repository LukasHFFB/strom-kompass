import { NextRequest, NextResponse } from 'next/server';
import { fetchNtpEndpoint } from '@/lib/netztransparenz/client';
import { parseGenericNtp } from '@/lib/netztransparenz/parser';
import { NTP_CONFIG } from '@/config/api';

/**
 * Universal API route for all Netztransparenz data sources.
 * Renamed to /api/energy/data to bypass Turbopack stale cache.
 */
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
    // Parse dates to ensure valid Date objects
    const dateFrom = new Date(from);
    const dateTo = new Date(to);

    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const rawCsv = await fetchNtpEndpoint(endpoint, dateFrom, dateTo);
    const data = parseGenericNtp(rawCsv);
    
    return NextResponse.json({
      meta: {
        count: data.length,
        endpoint: endpointKey,
        from,
        to
      },
      data
    });
  } catch (error: any) {
    console.error(`[API-DATA] Error fetching ${endpointKey}:`, error);
    return NextResponse.json({ error: error.message || 'Failed to fetch NTP data' }, { status: 500 });
  }
}
