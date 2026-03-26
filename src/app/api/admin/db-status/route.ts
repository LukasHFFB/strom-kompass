import { NextResponse } from 'next/server';
import { prisma } from '@/lib/data/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const password = request.headers.get('x-admin-password');
  const expectedPassword = process.env.ADMIN_PASSWORD || 'Alexander1234!!';

  if (password !== expectedPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [priceCount, genCount, forecastCount, capacityCount] = await Promise.all([
      prisma.priceData.count(),
      prisma.generationData.count(),
      prisma.forecastData.count(),
      prisma.capacityData.count(),
    ]);

    const [recentPrices, recentGen, recentForecast, recentCapacity] = await Promise.all([
      prisma.priceData.findMany({ take: 10, orderBy: { timestamp: 'desc' } }),
      prisma.generationData.findMany({ take: 10, orderBy: { timestamp: 'desc' } }),
      prisma.forecastData.findMany({ take: 10, orderBy: { timestamp: 'desc' } }),
      prisma.capacityData.findMany({ take: 10, orderBy: { date: 'desc' } }),
    ]);

    return NextResponse.json({
      counts: {
        prices: priceCount,
        generation: genCount,
        forecasts: forecastCount,
        capacity: capacityCount,
      },
      recent: {
        prices: recentPrices,
        generation: recentGen,
        forecasts: recentForecast,
        capacity: recentCapacity,
      },
    });
  } catch (err) {
    console.error('[Admin API Error]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
