'use client';

import { useState, useEffect, useMemo } from 'react';
import UniversalChart, { CHART_COMPAT, getSourceCategory, ChartType } from '@/components/charts/UniversalChart';
import { NTP_CONFIG } from '@/config/api';

// ─── Source Types ────────────────────────────────────────────────────────

interface CoreSource {
  id: string;
  label: string;
  path: string;
  unit: string;
}

interface NtpSource extends CoreSource {
  endpointKey: string;
}

type AnalyseSource = CoreSource | NtpSource;

function isNtp(s: AnalyseSource): s is NtpSource {
  return 'endpointKey' in s;
}

// ─── Constants ───────────────────────────────────────────────────────────

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: 'line', label: 'Linie' },
  { id: 'area', label: 'Fläche' },
  { id: 'bar',  label: 'Balken' },
];

const CORE_SOURCES: CoreSource[] = [
  { id: 'prices',     label: '⭐ Börsenstrompreise (Entso-E)',    path: '/api/energy/prices',     unit: 'EUR/MWh' },
  { id: 'generation', label: '⭐ Erzeugungs-Mix (Entso-E)',       path: '/api/energy/generation', unit: 'MW' },
  { id: 'load',       label: '⭐ Stromverbrauch (Entso-E)',       path: '/api/energy/load',       unit: 'MW' },
  { id: 'capacity',   label: '⭐ Installierte Leistung (BNetzA)', path: '/api/energy/capacity',   unit: 'MW' },
];

const NTP_SOURCES: NtpSource[] = Object.keys(NTP_CONFIG.endpoints).map((key) => ({
  id: `ntp_${key}`,
  label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()),
  path: '/api/energy/data',
  unit: 'n/a',
  endpointKey: key,
}));

const ALL_SOURCES: AnalyseSource[] = [...CORE_SOURCES, ...NTP_SOURCES];

// ─── Main Component ───────────────────────────────────────────────────────

export default function AnalysePage() {
  const [selectedSources, setSelectedSources] = useState<string[]>([CORE_SOURCES[1].id]);
  const [chartType, setChartType] = useState<ChartType>('area');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [datasets, setDatasets] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 4);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });

  // ─── Chart Type Filtering ─────────────────────────────────────────────
  // Intersection of valid chart types across all selected sources.
  // Falls back to showing all types when the intersection is empty (incompatible mix).

  const validChartTypes = useMemo<ChartType[]>(() => {
    if (selectedSources.length === 0) return CHART_TYPES.map((t) => t.id);
    const intersection = CHART_TYPES.map((t) => t.id).filter((id) =>
      selectedSources.every((sid) => {
        const cat = getSourceCategory(sid);
        const valid = CHART_COMPAT[cat] ?? CHART_COMPAT.ntp;
        return valid.includes(id as ChartType);
      })
    );
    return intersection.length > 0 ? intersection : CHART_TYPES.map((t) => t.id);
  }, [selectedSources]);

  // Auto-switch chart type when the current one becomes invalid for selected sources
  useEffect(() => {
    if (!validChartTypes.includes(chartType)) {
      setChartType(validChartTypes[0]);
    }
  }, [validChartTypes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Data Fetching ────────────────────────────────────────────────────

  async function fetchData() {
    if (selectedSources.length === 0) {
      setDatasets({});
      return;
    }

    setLoading(true);
    setError(null);

    const promises = selectedSources.map(async (sid) => {
      const source = ALL_SOURCES.find((s) => s.id === sid);
      if (!source) throw new Error(`Unbekannte Quelle: ${sid}`);

      const params = new URLSearchParams();
      if (sid === 'capacity') {
        params.set('year', String(new Date(fromDate).getFullYear()));
      } else {
        params.set('from', fromDate);
        params.set('to', toDate);
      }
      if (isNtp(source)) {
        params.set('endpoint', source.endpointKey);
      }

      const res = await fetch(`${source.path}?${params.toString()}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = (await res.json()) as { data?: any[]; error?: string };

      if (json.error) throw new Error(`${source.label}: ${json.error}`);
      if (!Array.isArray(json.data)) throw new Error(`${source.label}: Keine Daten`);

      return { sid, data: json.data };
    });

    const settled = await Promise.allSettled(promises);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newDatasets: Record<string, any[]> = {};
    const errors: string[] = [];

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        newDatasets[result.value.sid] = result.value.data;
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        errors.push(msg);
      }
    }

    setDatasets(newDatasets);
    if (errors.length > 0) setError(errors.join(' · '));
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [selectedSources, fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSource = (sid: string) => {
    setSelectedSources((prev) =>
      prev.includes(sid) ? prev.filter((id) => id !== sid) : [...prev, sid]
    );
  };

  const filteredSources = useMemo(() => {
    if (!searchTerm) return ALL_SOURCES;
    const low = searchTerm.toLowerCase();
    return ALL_SOURCES.filter((s) => s.label.toLowerCase().includes(low));
  }, [searchTerm]);

  const totalPoints = useMemo(
    () => Object.values(datasets).reduce((acc, ds) => acc + ds.length, 0),
    [datasets]
  );

  return (
    <div className="analyse-container">
      <div style={{ marginBottom: '2rem' }}>
        <h1>Analyse-Tool</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Wähle aus über 60 Datenquellen von Entso-E und Netztransparenz.
        </p>
      </div>

      <div className="grid grid-selector" style={{ gap: '2rem', alignItems: 'start' }}>
        {/* ── Config panel ── */}
        <div className="card" style={{ padding: '1.5rem', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem' }}>Konfiguration</h3>

          <div className="form-group" style={{ marginBottom: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Datenquellen ({selectedSources.length} gewählt)
            </label>
            <input
              type="text"
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', marginBottom: '0.75rem' }}
            />
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: '4px', padding: '0.5rem' }}>
              {filteredSources.map((s) => (
                <label
                  key={s.id}
                  className="checkbox-label"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', padding: '0.25rem 0' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(s.id)}
                    onChange={() => toggleSource(s.id)}
                  />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Zeitraum
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Diagrammtyp
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {CHART_TYPES.map((t) => {
                const isValid = validChartTypes.includes(t.id);
                const isActive = chartType === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => isValid && setChartType(t.id)}
                    disabled={!isValid}
                    title={!isValid ? 'Nicht kompatibel mit gewählten Quellen' : undefined}
                    style={{
                      padding: '0.4rem',
                      borderRadius: '4px',
                      border: '1px solid',
                      borderColor: isActive ? 'var(--primary)' : '#ddd',
                      background: isActive ? 'var(--primary-light)' : '#fff',
                      color: isActive ? 'var(--primary)' : isValid ? 'var(--text)' : '#bbb',
                      cursor: isValid ? 'pointer' : 'not-allowed',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      opacity: isValid ? 1 : 0.5,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: loading ? '#ccc' : 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'wait' : 'pointer',
              fontWeight: 600,
            }}
          >
            {loading ? 'Lade Daten...' : 'Aktualisieren'}
          </button>
        </div>

        {/* ── Preview panel ── */}
        <div className="card" style={{ minHeight: '85vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {loading && (
            <div style={{ height: '3px', width: '100%', background: '#eee', overflow: 'hidden', position: 'absolute', top: 0, left: 0, zIndex: 10 }}>
              <div className="loading-progress" />
            </div>
          )}

          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Vorschau</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {totalPoints.toLocaleString('de-DE')} Datenpunkte
            </div>
          </div>

          <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
            {error && (
              <div
                className="card"
                style={{ background: '#fff1f2', color: '#991b1b', border: '1px solid #fecaca', marginBottom: '1.5rem', padding: '1rem', fontSize: '0.85rem' }}
              >
                <strong>Fehler:</strong> {error}
              </div>
            )}

            {selectedSources.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '2px dashed #f0f0f0', borderRadius: '12px' }}>
                Wähle links Datenquellen aus.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                {selectedSources.map((sid) => {
                  const dsData = datasets[sid] || [];
                  const source = ALL_SOURCES.find((s) => s.id === sid);
                  if (loading && dsData.length === 0)
                    return <div key={sid} className="loading-shimmer" style={{ height: '350px' }} />;
                  if (dsData.length === 0) return null;

                  return (
                    <div key={sid}>
                      <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>{source?.label}</h3>
                      <UniversalChart type={chartType} data={dsData} height={350} sourceId={sid} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .analyse-container { padding: 1rem 0; }
        .grid-selector { display: grid; grid-template-columns: 320px 1fr; }
        .loading-progress { height: 100%; width: 40%; background: var(--primary); animation: loading-bar 1s infinite linear; }
        @keyframes loading-bar { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
        @media (max-width: 1000px) { .grid-selector { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
