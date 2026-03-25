import { type NextRequest } from 'next/server';
import { getForecasts } from '@/lib/data/consolidator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const from = sp.get('from');
    const to = sp.get('to');
    const type = sp.get('type') as 'solar' | 'wind' | null;

    if (!from || !to) {
      return Response.json(
        { error: 'Missing required query params: from, to (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    if (!type || !['solar', 'wind'].includes(type)) {
      return Response.json(
        { error: 'Missing or invalid "type" param. Use solar or wind.' },
        { status: 400 }
      );
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return Response.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    const result = await getForecasts(type, fromDate, toDate);
    return Response.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /energy/forecasts]', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
