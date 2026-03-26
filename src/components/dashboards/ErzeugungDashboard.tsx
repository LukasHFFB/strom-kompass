'use client';

import { useState, useEffect } from 'react';
import GenerationStackedArea, { GenerationPoint } from '@/components/charts/GenerationStackedArea';
import CapacityBarChart, { CapacityItem } from '@/components/charts/CapacityBarChart';

export default function ErzeugungDashboard() {
  const [genData, setGenData] = useState<GenerationPoint[]>([]);
  const [capData, setCapData] = useState<CapacityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 2); // Last 48 hours for generation

        const [genRes, capRes] = await Promise.all([
          fetch(`/api/energy/generation?from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}`),
          fetch(`/api/energy/capacity?year=${new Date().getFullYear()}`)
        ]);

        const genJson = await genRes.json();
        const capJson = await capRes.json();

        if (genJson.data) setGenData(genJson.data);
        if (capJson.data) setCapData(capJson.data);

        if (!genJson.data && !capJson.data) {
          setError('Fehler beim Laden der Erzeugungsdaten');
        }
      } catch (err) {
        setError('Netzwerk-Fehler beim Laden der Daten');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>Erzeugungsmix (Real-Time)</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Letzte 48 Stunden (MW)
          </span>
        </div>
        
        {loading ? (
          <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Lade Erzeugungsdaten...
          </div>
        ) : error ? (
          <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}>
            {error}
          </div>
        ) : (
          <GenerationStackedArea data={genData} height={400} />
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>Installierte Leistung</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Kapazitäts-Übersicht Deutschland {new Date().getFullYear()}
          </span>
        </div>
        
        {loading ? (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Lade Kapazitätsdaten...
          </div>
        ) : (
          <CapacityBarChart data={capData} />
        )}
      </div>
    </>
  );
}
