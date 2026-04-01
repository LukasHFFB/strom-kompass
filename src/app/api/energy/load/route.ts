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

    // 2. Fallback to API if no data — fetch in chunks to avoid range limits
    if (data.length === 0) {
      console.log(`[Load API] Cache miss, fetching from ENTSO-E in chunks...`);

      const msPerDay = 86_400_000;
      const chunks: { from: Date; to: Date }[] = [];
      let start = fromDate.getTime();
      const end = toDate.getTime();
      while (start < end) {
        const chunkEnd = Math.min(start + 90 * msPerDay, end);
        chunks.push({ from: new Date(start), to: new Date(chunkEnd) });
        start = chunkEnd;
      }
      if (chunks.length === 0) chunks.push({ from: fromDate, to: toDate });

      const allParsed: any[] = [];
      for (const chunk of chunks) {
        let jsonObj = await fetchLoad(chunk.from, chunk.to);
        if (!jsonObj) {
          jsonObj = await fetchLoad(chunk.from, chunk.to, '10Y1001A1001A83F');
        }
        if (jsonObj) {
          allParsed.push(...parseActualLoad(jsonObj));
        }
      }

      console.log(`[Load API] Parsed ${allParsed.length} records total`);

      if (allParsed.length > 0) {
        await upsertLoadData(allParsed);
        data = allParsed;
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
