import { NextResponse } from 'next/server';
import { fetchLoad } from '@/lib/entsoe/client';
import { parseActualLoad } from '@/lib/entsoe/parser';
import { upsertLoadData, queryLoadData } from '@/lib/data/persistence';
import { DataSource } from '@/types/energy';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json(
      { error: 'Missing from/to parameters' },
      { status: 400 }
    );
  }

  try {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    // 1. Try DB first
    let data = await queryLoadData(fromDate, toDate);

    // 2. Fallback to API if no data
    if (data.length === 0) {
      console.log(`[Load API] Cache miss, fetching from ENTSO-E...`);
      
      // Try DE-LU first (10Y1001A1001A82H)
      let jsonObj = await fetchLoad(fromDate, toDate);
      
      // If no data, try DE-only (10Y1001A1001A83F)
      if (!jsonObj) {
        console.log(`[Load API] No data for DE-LU, trying DE-only legacy EIC...`);
        jsonObj = await fetchLoad(fromDate, toDate, '10Y1001A1001A83F');
      }

      if (!jsonObj) {
        return NextResponse.json({
          data: [],
          meta: { source: DataSource.ENTSOE, from, to, count: 0, fetchedAt: new Date().toISOString(), message: 'No data returned from ENTSO-E' }
        });
      }

      const parsedData = parseActualLoad(jsonObj);
      console.log(`[Load API] Parsed ${parsedData.length} records`);
      
      if (parsedData.length > 0) {
        await upsertLoadData(parsedData);
        data = parsedData;
      }
    }

    return NextResponse.json({
      data,
      meta: {
        source: DataSource.ENTSOE,
        from,
        to,
        count: data.length,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[Load API Error]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
