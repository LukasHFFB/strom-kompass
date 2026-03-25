import { type NextRequest } from 'next/server';
import { getGenerationMix } from '@/lib/data/consolidator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const from = sp.get('from');
    const to = sp.get('to');

    if (!from || !to) {
      return Response.json(
        { error: 'Missing required query params: from, to (YYYY-MM-DD)' },
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

    const result = await getGenerationMix(fromDate, toDate);
    return Response.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /energy/generation]', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
