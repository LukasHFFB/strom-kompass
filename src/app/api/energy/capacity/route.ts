import { type NextRequest } from 'next/server';
import { getInstalledCapacityData } from '@/lib/data/consolidator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const yearParam = sp.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    if (isNaN(year) || year < 2015 || year > 2030) {
      return Response.json(
        { error: 'Invalid year. Provide a year between 2015 and 2030.' },
        { status: 400 }
      );
    }

    const result = await getInstalledCapacityData(year);
    return Response.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /energy/capacity]', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
