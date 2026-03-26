'use client';

import { useState } from 'react';

interface ApiEndpoint {
  label: string;
  path: string;
  params: string;
}

const ENDPOINTS: ApiEndpoint[] = [
  {
    label: 'Day-Ahead Preise',
    path: '/api/energy/prices',
    params: '?from=2026-03-24&to=2026-03-25',
  },
  {
    label: 'Erzeugungsmix',
    path: '/api/energy/generation',
    params: '?from=2026-03-24&to=2026-03-25',
  },
  {
    label: 'Installierte Leistung',
    path: '/api/energy/capacity',
    params: '?year=2026',
  },
  {
    label: 'Marktwerte (NTP)',
    path: '/api/energy/market-values',
    params: '?from=2026-01-01&to=2026-03-25',
  },
  {
    label: 'Solar-Prognose (NTP)',
    path: '/api/energy/forecasts',
    params: '?type=solar&from=2026-03-24&to=2026-03-25',
  },
  {
    label: 'Wind-Prognose (NTP)',
    path: '/api/energy/forecasts',
    params: '?type=wind&from=2026-03-24&to=2026-03-25',
  },
];

import HomeDashboard from '@/components/dashboards/HomeDashboard';

export default function HomePage() {
  const [results, setResults] = useState<Record<string, { status: string; data?: unknown; error?: string }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function testEndpoint(ep: ApiEndpoint) {
    setLoading((l) => ({ ...l, [ep.label]: true }));
    setResults((r) => ({ ...r, [ep.label]: { status: 'loading' } }));

    try {
      const res = await fetch(ep.path + ep.params);
      const json = await res.json();

      if (res.ok) {
        setResults((r) => ({
          ...r,
          [ep.label]: { status: 'ok', data: json },
        }));
      } else {
        setResults((r) => ({
          ...r,
          [ep.label]: { status: 'error', error: json.error ?? res.statusText },
        }));
      }
    } catch (err) {
      setResults((r) => ({
        ...r,
        [ep.label]: {
          status: 'error',
          error: err instanceof Error ? err.message : 'Network error',
        },
      }));
    } finally {
      setLoading((l) => ({ ...l, [ep.label]: false }));
    }
  }

  async function testAll() {
    for (const ep of ENDPOINTS) {
      await testEndpoint(ep);
    }
  }

  return (
    <>
      <h2 style={{ margin: '1rem 0' }}>Markt-Übersicht</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Deutschlands Energiemarkt auf einen Blick — Preise und Erzeugung in Echtzeit.
      </p>

      <HomeDashboard />

      <h2 style={{ margin: '3rem 0 1rem 0' }}>API Dashboard</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Test-Oberfläche für die Energiedaten-APIs. Klicke auf einen Endpoint oder
        teste alle gleichzeitig.
      </p>

      <button
        onClick={testAll}
        style={{
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          padding: '0.5rem 1.25rem',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.9rem',
          marginBottom: '1.5rem',
        }}
      >
        Alle testen
      </button>

      <div className="grid grid-2">
        {ENDPOINTS.map((ep) => {
          const result = results[ep.label];
          const isLoading = loading[ep.label];
          const count = result?.status === 'ok' && typeof result.data === 'object' && result.data !== null
            ? (result.data as { meta?: { count?: number } }).meta?.count
            : undefined;

          return (
            <div className="card" key={ep.label}>
              <h2>{ep.label}</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '0.75rem' }}>
                {ep.path}{ep.params}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  onClick={() => testEndpoint(ep)}
                  disabled={isLoading}
                  style={{
                    background: isLoading ? '#ccc' : 'var(--primary-light)',
                    color: 'var(--primary)',
                    border: '1px solid var(--primary)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '4px',
                    cursor: isLoading ? 'wait' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {isLoading ? '...' : 'Test'}
                </button>

                {result && (
                  <span
                    className={`status-badge ${result.status}`}
                  >
                    {result.status === 'ok'
                      ? `✓ ${count !== undefined ? `${count} Datenpunkte` : 'OK'}`
                      : result.status === 'loading'
                        ? 'Laden...'
                        : '✗ Fehler'}
                  </span>
                )}
              </div>

              {result?.status === 'error' && (
                <div className="api-test-result" style={{ color: 'var(--red)' }}>
                  {result.error}
                </div>
              )}

              {result?.status === 'ok' && (
                <div className="api-test-result">
                  {JSON.stringify(result.data, null, 2).slice(0, 1500)}
                  {JSON.stringify(result.data, null, 2).length > 1500 && '\n...'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
