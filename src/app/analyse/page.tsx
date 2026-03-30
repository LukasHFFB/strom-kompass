'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import MultiAxisChart from '@/components/charts/MultiAxisChart';
import {
  ALL_SOURCES,
  getSourceById,
  getSourcesByCategory,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '@/lib/chart-builder/sources';
import { CHART_TYPE_OPTIONS } from '@/lib/chart-builder/compatibility';
import { serializeState, deserializeState, getShareUrl } from '@/lib/chart-builder/url';
import type {
  DatasetConfig,
  ChartType,
  ChartDataset,
  NormalizedDataPoint,
  DataSourceDef,
} from '@/lib/chart-builder/types';
import { PALETTE } from '@/lib/chart-builder/types';

// ---- Timeframe presets ----

const TIMEFRAME_PRESETS = [
  { label: 'Heute', days: 0 },
  { label: '3 Tage', days: 3 },
  { label: '7 Tage', days: 7 },
  { label: '30 Tage', days: 30 },
  { label: '90 Tage', days: 90 },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ---- Data normalization ----

function normalizeData(sourceId: string, rawData: any[]): NormalizedDataPoint[] {
  const source = getSourceById(sourceId);
  if (!source) return [];

  if (source.energyType) {
    // Filter generation data by energy type
    return rawData
      .filter((d: any) => d.type === source.energyType)
      .map((d: any) => ({ timestamp: d.timestamp, value: Number(d.value) || 0 }))
      .sort((a: NormalizedDataPoint, b: NormalizedDataPoint) => a.timestamp.localeCompare(b.timestamp));
  }

  return rawData
    .map((d: any) => ({
      timestamp: d.timestamp,
      value: Number(d[source.valueKey] ?? d.value ?? d.price ?? 0),
    }))
    .filter((d: NormalizedDataPoint) => d.timestamp)
    .sort((a: NormalizedDataPoint, b: NormalizedDataPoint) => a.timestamp.localeCompare(b.timestamp));
}

// ---- Default axis assignment ----

function getDefaultAxis(
  sourceId: string,
  existing: DatasetConfig[],
): 'left' | 'right' {
  if (existing.length === 0) return 'left';
  const newSource = getSourceById(sourceId);
  const firstSource = getSourceById(existing[0].sourceId);
  if (!newSource || !firstSource) return 'left';
  // Same unit → same axis; different unit → opposite axis
  if (newSource.unit === firstSource.unit) return 'left';
  return 'right';
}

// ---- Page component ----

export default function AnalysePage() {
  // Builder state
  const [datasets, setDatasets] = useState<DatasetConfig[]>([]);
  const [chartType, setChartType] = useState<ChartType>('line');
  const [from, setFrom] = useState(() => daysAgo(4));
  const [to, setTo] = useState(() => daysAgo(1));
  const [title, setTitle] = useState('');

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(['prices', 'generation']),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedRaw, setFetchedRaw] = useState<Record<string, any[]>>({});
  const [copied, setCopied] = useState(false);
  const initialized = useRef(false);

  // ---- Restore state from URL on mount ----

  useEffect(() => {
    const restored = deserializeState(window.location.search);
    if (restored.datasets?.length) setDatasets(restored.datasets);
    if (restored.chartType) setChartType(restored.chartType);
    if (restored.from) setFrom(restored.from);
    if (restored.to) setTo(restored.to);
    if (restored.title) setTitle(restored.title);
    initialized.current = true;
  }, []);

  // ---- Persist state to URL ----

  useEffect(() => {
    if (!initialized.current) return;
    const query = serializeState({ datasets, chartType, from, to, title });
    window.history.replaceState(null, '', `?${query}`);
  }, [datasets, chartType, from, to, title]);

  // ---- Fetch data when datasets or timeframe change ----

  useEffect(() => {
    if (!initialized.current) return;
    if (datasets.length === 0) {
      setFetchedRaw({});
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(null);

      try {
        const results: Record<string, any[]> = {};

        // Group sources by API path to deduplicate requests
        const byPath = new Map<string, string[]>();
        for (const ds of datasets) {
          const source = getSourceById(ds.sourceId);
          if (!source) continue;
          const basePath = source.path.split('?')[0]; // strip query params for grouping
          if (!byPath.has(source.path)) byPath.set(source.path, []);
          byPath.get(source.path)!.push(ds.sourceId);
        }

        const promises = Array.from(byPath.entries()).map(async ([path, sourceIds]) => {
          const source = getSourceById(sourceIds[0])!;
          const params = new URLSearchParams();
          params.set('from', from);
          params.set('to', to);

          if (source.endpointKey) {
            params.set('endpoint', source.endpointKey);
          }

          const sep = path.includes('?') ? '&' : '?';
          const res = await fetch(`${path}${sep}${params.toString()}`);
          const json = await res.json();

          if (json.error) throw new Error(`${source.label}: ${json.error}`);
          if (!json.data) return;

          // Store raw data for all sources using this path
          for (const sid of sourceIds) {
            results[sid] = json.data;
          }
        });

        await Promise.all(promises);
        if (!cancelled) setFetchedRaw(results);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Fehler beim Laden.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [datasets, from, to]);

  // ---- Normalize fetched data into chart datasets ----

  const chartDatasets: ChartDataset[] = useMemo(() => {
    return datasets
      .map(ds => {
        const source = getSourceById(ds.sourceId);
        if (!source) return null;
        const raw = fetchedRaw[ds.sourceId];
        if (!raw) return null;
        const data = normalizeData(ds.sourceId, raw);
        if (data.length === 0) return null;

        // Try to extract unit from actual data if source unit is empty
        let unit = source.unit;
        if (!unit && raw[0]?.unit) unit = raw[0].unit;

        return {
          id: ds.sourceId,
          label: source.label,
          data,
          color: ds.color,
          yAxis: ds.yAxis,
          unit: unit || '',
        };
      })
      .filter((d): d is ChartDataset => d !== null);
  }, [datasets, fetchedRaw]);

  // ---- Dataset actions ----

  const addDataset = useCallback(
    (sourceId: string) => {
      setDatasets(prev => {
        if (prev.some(d => d.sourceId === sourceId)) return prev;
        const color = PALETTE[prev.length % PALETTE.length];
        const yAxis = getDefaultAxis(sourceId, prev);
        return [...prev, { sourceId, color, yAxis }];
      });
    },
    [],
  );

  const removeDataset = useCallback((sourceId: string) => {
    setDatasets(prev => prev.filter(d => d.sourceId !== sourceId));
  }, []);

  const toggleAxis = useCallback((sourceId: string) => {
    setDatasets(prev =>
      prev.map(d =>
        d.sourceId === sourceId
          ? { ...d, yAxis: d.yAxis === 'left' ? 'right' : 'left' }
          : d,
      ),
    );
  }, []);

  const toggleSource = useCallback(
    (sourceId: string) => {
      if (datasets.some(d => d.sourceId === sourceId)) {
        removeDataset(sourceId);
      } else {
        addDataset(sourceId);
      }
    },
    [datasets, addDataset, removeDataset],
  );

  // ---- Category toggle ----

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // ---- Timeframe presets ----

  const applyPreset = useCallback((days: number) => {
    if (days === 0) {
      setFrom(today());
      setTo(today());
    } else {
      setFrom(daysAgo(days));
      setTo(daysAgo(1));
    }
  }, []);

  // ---- Share ----

  const handleShare = useCallback(() => {
    const url = getShareUrl({ datasets, chartType, from, to, title });
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [datasets, chartType, from, to, title]);

  // ---- Filtered source list ----

  const sourcesByCategory = useMemo(() => getSourcesByCategory(), []);

  const filteredByCategory = useMemo(() => {
    if (!searchTerm) return sourcesByCategory;
    const low = searchTerm.toLowerCase();
    const filtered = new Map<string, DataSourceDef[]>();
    for (const [cat, sources] of sourcesByCategory) {
      const match = sources.filter(s => s.label.toLowerCase().includes(low));
      if (match.length > 0) filtered.set(cat, match);
    }
    return filtered;
  }, [sourcesByCategory, searchTerm]);

  // ---- Total data points ----

  const totalPoints = useMemo(
    () => chartDatasets.reduce((sum, ds) => sum + ds.data.length, 0),
    [chartDatasets],
  );

  // ---- Render ----

  return (
    <div style={{ padding: '1rem 0' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Chart Builder</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Erstelle benutzerdefinierte Diagramme aus über 60 Datenquellen.
        </p>
      </div>

      <div className="builder-grid">
        {/* ──── SIDEBAR ──── */}
        <div className="card builder-sidebar">
          {/* Step 1: Data sources */}
          <div className="builder-step">
            <div className="step-header">
              <span className="step-badge">1</span>
              <span className="step-title">Daten wählen</span>
              <span className="step-count">{datasets.length} gewählt</span>
            </div>

            {/* Selected dataset chips */}
            {datasets.length > 0 && (
              <div className="selected-chips">
                {datasets.map(ds => {
                  const source = getSourceById(ds.sourceId);
                  return (
                    <div key={ds.sourceId} className="chip">
                      <span className="chip-color" style={{ background: ds.color }} />
                      <span className="chip-label">{source?.label || ds.sourceId}</span>
                      <button
                        className="chip-axis"
                        onClick={() => toggleAxis(ds.sourceId)}
                        title={ds.yAxis === 'left' ? 'Linke Y-Achse' : 'Rechte Y-Achse'}
                      >
                        {ds.yAxis === 'left' ? 'L' : 'R'}
                      </button>
                      <button className="chip-remove" onClick={() => removeDataset(ds.sourceId)}>
                        x
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Search */}
            <input
              type="text"
              placeholder="Suchen..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="builder-input"
              style={{ marginBottom: '0.5rem' }}
            />

            {/* Categorized source list */}
            <div className="source-list">
              {CATEGORY_ORDER.filter(cat => filteredByCategory.has(cat)).map(cat => {
                const sources = filteredByCategory.get(cat)!;
                const isExpanded = expandedCategories.has(cat) || !!searchTerm;
                return (
                  <div key={cat}>
                    <button className="category-header" onClick={() => toggleCategory(cat)}>
                      <span>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                      <span>{CATEGORY_LABELS[cat]}</span>
                      <span className="category-count">{sources.length}</span>
                    </button>
                    {isExpanded && (
                      <div className="category-items">
                        {sources.map(s => {
                          const isSelected = datasets.some(d => d.sourceId === s.id);
                          const ds = datasets.find(d => d.sourceId === s.id);
                          return (
                            <label key={s.id} className="source-item">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSource(s.id)}
                              />
                              {ds && (
                                <span
                                  className="chip-color"
                                  style={{ background: ds.color }}
                                />
                              )}
                              <span className="source-label">{s.label}</span>
                              {s.unit && (
                                <span className="source-unit">{s.unit}</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Chart type */}
          <div className="builder-step">
            <div className="step-header">
              <span className="step-badge">2</span>
              <span className="step-title">Diagrammtyp</span>
            </div>
            <div className="chart-type-grid">
              {CHART_TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={`chart-type-btn ${chartType === opt.id ? 'active' : ''}`}
                  onClick={() => setChartType(opt.id)}
                >
                  <div style={{ fontWeight: 600 }}>{opt.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {opt.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Timeframe */}
          <div className="builder-step">
            <div className="step-header">
              <span className="step-badge">3</span>
              <span className="step-title">Zeitraum</span>
            </div>
            <div className="preset-row">
              {TIMEFRAME_PRESETS.map(p => (
                <button
                  key={p.days}
                  className="preset-btn"
                  onClick={() => applyPreset(p.days)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
              <div>
                <label className="input-label">Von</label>
                <input
                  type="date"
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  className="builder-input"
                />
              </div>
              <div>
                <label className="input-label">Bis</label>
                <input
                  type="date"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="builder-input"
                />
              </div>
            </div>
          </div>

          {/* Step 4: Options */}
          <div className="builder-step">
            <div className="step-header">
              <span className="step-badge">4</span>
              <span className="step-title">Optionen</span>
            </div>
            <label className="input-label">Titel (optional)</label>
            <input
              type="text"
              placeholder="Mein Diagramm..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="builder-input"
            />
            <button
              className="share-btn"
              onClick={handleShare}
              disabled={datasets.length === 0}
              style={{ marginTop: '0.75rem' }}
            >
              {copied ? 'Link kopiert!' : 'Link teilen'}
            </button>
          </div>
        </div>

        {/* ──── PREVIEW ──── */}
        <div className="card builder-preview">
          {loading && (
            <div className="loading-bar-track">
              <div className="loading-bar-fill" />
            </div>
          )}

          <div className="preview-header">
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
              {title || 'Vorschau'}
            </h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {totalPoints > 0 && `${totalPoints.toLocaleString('de-DE')} Datenpunkte`}
            </div>
          </div>

          <div className="preview-body">
            {error && (
              <div className="error-box">
                <strong>Fehler:</strong> {error}
              </div>
            )}

            {datasets.length === 0 ? (
              <div className="empty-state">
                Wähle links Datenquellen aus, um ein Diagramm zu erstellen.
              </div>
            ) : loading && chartDatasets.length === 0 ? (
              <div className="loading-shimmer" style={{ height: '400px', borderRadius: '8px' }} />
            ) : (
              <MultiAxisChart
                datasets={chartDatasets}
                chartType={chartType}
                height={450}
              />
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .builder-grid {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 1.5rem;
          align-items: start;
        }
        @media (max-width: 1000px) {
          .builder-grid { grid-template-columns: 1fr; }
        }

        /* Sidebar */
        .builder-sidebar {
          padding: 0 !important;
          max-height: 88vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .builder-step {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border);
        }
        .builder-step:last-child { border-bottom: none; }

        /* Step header */
        .step-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .step-badge {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--primary);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .step-title {
          font-weight: 600;
          font-size: 0.85rem;
        }
        .step-count {
          margin-left: auto;
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        /* Selected chips */
        .selected-chips {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          margin-bottom: 0.75rem;
        }
        .chip {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.3rem 0.5rem;
          background: var(--primary-light);
          border-radius: 4px;
          font-size: 0.75rem;
        }
        .chip-color {
          width: 8px;
          height: 8px;
          border-radius: 2px;
          flex-shrink: 0;
        }
        .chip-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .chip-axis {
          background: var(--primary);
          color: #fff;
          border: none;
          border-radius: 3px;
          width: 20px;
          height: 18px;
          font-size: 0.65rem;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
        }
        .chip-remove {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.8rem;
          padding: 0 2px;
          flex-shrink: 0;
        }
        .chip-remove:hover { color: var(--red); }

        /* Source list */
        .source-list {
          max-height: 35vh;
          overflow-y: auto;
          border: 1px solid var(--border);
          border-radius: 4px;
        }
        .category-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          width: 100%;
          padding: 0.5rem 0.6rem;
          background: #f8f8f8;
          border: none;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 600;
          text-align: left;
          color: var(--text);
        }
        .category-header:hover { background: #f0f0f0; }
        .category-count {
          margin-left: auto;
          color: var(--text-muted);
          font-weight: 400;
        }
        .category-items {
          border-bottom: 1px solid var(--border);
        }
        .source-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.3rem 0.6rem 0.3rem 1.2rem;
          cursor: pointer;
          font-size: 0.75rem;
        }
        .source-item:hover { background: #fafafa; }
        .source-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .source-unit {
          color: var(--text-muted);
          font-size: 0.65rem;
          flex-shrink: 0;
        }

        /* Chart type grid */
        .chart-type-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }
        .chart-type-btn {
          padding: 0.5rem;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: #fff;
          cursor: pointer;
          text-align: left;
          font-size: 0.8rem;
          transition: all 0.15s;
        }
        .chart-type-btn:hover { border-color: var(--primary); }
        .chart-type-btn.active {
          border-color: var(--primary);
          background: var(--primary-light);
          color: var(--primary);
        }

        /* Timeframe */
        .preset-row {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }
        .preset-btn {
          padding: 0.3rem 0.6rem;
          border-radius: 4px;
          border: 1px solid var(--border);
          background: #fff;
          cursor: pointer;
          font-size: 0.7rem;
          font-weight: 500;
          transition: all 0.15s;
        }
        .preset-btn:hover {
          border-color: var(--primary);
          background: var(--primary-light);
        }
        .input-label {
          display: block;
          font-size: 0.7rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
          color: var(--text-muted);
        }
        .builder-input {
          width: 100%;
          padding: 0.4rem 0.5rem;
          border-radius: 4px;
          border: 1px solid var(--border);
          font-size: 0.8rem;
          font-family: inherit;
        }

        /* Share button */
        .share-btn {
          width: 100%;
          padding: 0.6rem;
          border-radius: 6px;
          border: 1px solid var(--primary);
          background: var(--primary);
          color: #fff;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.8rem;
          transition: opacity 0.15s;
        }
        .share-btn:hover { opacity: 0.9; }
        .share-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Preview */
        .builder-preview {
          min-height: 88vh;
          display: flex;
          flex-direction: column;
          position: relative;
          padding: 0 !important;
        }
        .preview-header {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .preview-body {
          flex: 1;
          padding: 1.5rem;
        }
        .empty-state {
          height: 100%;
          min-height: 400px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          border: 2px dashed var(--border);
          border-radius: 12px;
          font-size: 0.9rem;
        }
        .error-box {
          background: #fff1f2;
          color: #991b1b;
          border: 1px solid #fecaca;
          padding: 0.75rem 1rem;
          border-radius: 6px;
          font-size: 0.85rem;
          margin-bottom: 1rem;
        }

        /* Loading */
        .loading-bar-track {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 3px;
          background: #eee;
          overflow: hidden;
          z-index: 10;
        }
        .loading-bar-fill {
          height: 100%;
          width: 40%;
          background: var(--primary);
          animation: slide 1s infinite linear;
        }
        @keyframes slide {
          from { transform: translateX(-100%); }
          to { transform: translateX(350%); }
        }
        .loading-shimmer {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
