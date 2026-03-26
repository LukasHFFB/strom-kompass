'use client';

import { useState, useEffect } from 'react';
import PriceLineChart, { PricePoint } from '@/components/charts/PriceLineChart';
import GenerationStackedArea, { GenerationPoint } from '@/components/charts/GenerationStackedArea';

export default function HomeDashboard() {
  const [priceData, setPriceData] = useState<PricePoint[]>([]);
  const [genData, setGenData] = useState<GenerationPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 1);

        const [pRes, gRes] = await Promise.all([
          fetch(`/api/energy/prices?from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}`),
          fetch(`/api/energy/generation?from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}`)
        ]);

        const pJson = await pRes.json();
        const gJson = await gRes.json();

        if (pJson.data) setPriceData(pJson.data);
        if (gJson.data) setGenData(gJson.data);
      } catch (err) {
        console.error('HomeDashboard fetch failed', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const latestPrice = priceData.length > 0 ? priceData[priceData.length - 1].price : null;

  return (
    <div style={{ marginBottom: '3rem' }}>
      <div className="grid grid-2">
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2>Strompreis heute</h2>
            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>
              {latestPrice !== null ? `${latestPrice.toFixed(2)} EUR/MWh` : '—'}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: '200px' }}>
            {loading ? <div className="loading-shimmer" style={{ height: '200px' }} /> : (
              <PriceLineChart data={priceData} height={200} />
            )}
          </div>
          <a href="/strompreis" style={{ fontSize: '0.8rem', marginTop: '1rem', fontWeight: 600 }}>
            Alle Details &rarr;
          </a>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2>Erzeugung heute</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Mix in GW
            </div>
          </div>
          <div style={{ flex: 1, minHeight: '200px' }}>
            {loading ? <div className="loading-shimmer" style={{ height: '200px' }} /> : (
              <GenerationStackedArea data={genData} height={200} />
            )}
          </div>
          <a href="/erzeugung" style={{ fontSize: '0.8rem', marginTop: '1rem', fontWeight: 600 }}>
            Erzeugungs-Mix &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
