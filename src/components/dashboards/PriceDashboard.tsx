'use client';

import { useState, useEffect } from 'react';
import PriceLineChart, { PricePoint } from '@/components/charts/PriceLineChart';

export default function PriceDashboard() {
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 1); // Last 24-48 hours

        const res = await fetch(
          `/api/energy/prices?from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}`
        );
        const json = await res.json();
        if (json.data) {
          setData(json.data);
        } else {
          setError(json.error || 'Fehler beim Laden der Preisdaten');
        }
      } catch (err) {
        setError('Netzwerk-Fehler beim Laden der Daten');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const latestPrice = data.length > 0 ? data[data.length - 1].price : null;
  const avgPrice = data.length > 0 ? data.reduce((acc, d) => acc + d.price, 0) / data.length : null;
  const minPrice = data.length > 0 ? Math.min(...data.map(d => d.price)) : null;
  const maxPrice = data.length > 0 ? Math.max(...data.map(d => d.price)) : null;

  return (
    <>
      <div className="grid grid-3">
        <div className="card">
          <h2>Aktueller Preis</h2>
          <div className="value">
            {loading ? '...' : latestPrice !== null ? latestPrice.toFixed(2) : '—'}
            <span className="unit">EUR/MWh</span>
          </div>
          <div className="subtitle">Day-Ahead Börsenpreis</div>
        </div>
        <div className="card">
          <h2>Tagesdurchschnitt</h2>
          <div className="value">
            {loading ? '...' : avgPrice !== null ? avgPrice.toFixed(2) : '—'}
            <span className="unit">EUR/MWh</span>
          </div>
          <div className="subtitle">Mittelwert Zeitraum</div>
        </div>
        <div className="card">
          <h2>Preisspanne</h2>
          <div className="value" style={{ fontSize: '1.25rem' }}>
            {loading ? '...' : minPrice !== null ? `${minPrice.toFixed(1)} / ${maxPrice?.toFixed(1)}` : '—'}
          </div>
          <div className="subtitle">Min / Max (EUR/MWh)</div>
        </div>
      </div>

      <div className="card" style={{ minHeight: '450px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>Preisverlauf (Day-Ahead)</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Letzte 24-48 Stunden
          </span>
        </div>
        
        {loading ? (
          <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Lade Chart-Daten...
          </div>
        ) : error ? (
          <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}>
            {error}
          </div>
        ) : (
          <PriceLineChart data={data} height={350} />
        )}
      </div>
    </>
  );
}
