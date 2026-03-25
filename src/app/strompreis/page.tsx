import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Strompreis heute — Aktueller Börsenstrompreis & Verlauf',
  description:
    'Aktueller Day-Ahead Strompreis an der Börse (EPEX Spot) für Deutschland. Historischer Verlauf, Prognose und Analyse.',
  keywords: [
    'Strompreis heute',
    'Strompreis aktuell',
    'Börsenstrompreis',
    'Day-Ahead Preis',
    'Strompreis Verlauf',
    'EPEX Spot',
  ],
};

export default function StrompreisPage() {
  return (
    <>
      <h2 style={{ margin: '1rem 0' }}>Strompreis Deutschland</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Aktueller Day-Ahead Börsenstrompreis (EPEX Spot, Gebotszone DE-LU) und
        historischer Verlauf. Datenquelle: ENTSO-E Transparency Platform.
      </p>

      <div className="grid grid-3">
        <div className="card">
          <h2>Aktueller Preis</h2>
          <div className="value">—</div>
          <div className="subtitle">EUR/MWh · Day-Ahead</div>
        </div>
        <div className="card">
          <h2>Tagesdurchschnitt</h2>
          <div className="value">—</div>
          <div className="subtitle">EUR/MWh</div>
        </div>
        <div className="card">
          <h2>Preisspanne heute</h2>
          <div className="value">—</div>
          <div className="subtitle">Min / Max</div>
        </div>
      </div>

      <div className="card">
        <h2>Preisverlauf</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Interaktiver Chart kommt in Phase 2. Die API-Daten sind bereits über{' '}
          <code>/api/energy/prices</code> verfügbar.
        </p>
      </div>
    </>
  );
}
