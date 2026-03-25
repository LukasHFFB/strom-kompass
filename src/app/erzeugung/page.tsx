import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stromerzeugung Deutschland — Erzeugungsmix & installierte Leistung',
  description:
    'Aktueller Stromerzeugungsmix und installierte Erzeugungskapazitäten in Deutschland — Solar, Wind, Kohle, Gas, Kernenergie und mehr.',
  keywords: [
    'Stromerzeugung Deutschland',
    'Erzeugungsmix',
    'installierte Leistung',
    'erneuerbare Energien',
    'Energiewende',
    'Solar Kapazität',
    'Windkraft Deutschland',
  ],
};

export default function ErzeugungPage() {
  return (
    <>
      <h2 style={{ margin: '1rem 0' }}>Stromerzeugung & Kapazitäten</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Installierte Erzeugungskapazitäten und aktueller Erzeugungsmix in
        Deutschland. Datenquellen: ENTSO-E, Netztransparenz.de.
      </p>

      <div className="card">
        <h2>Installierte Leistung (aktuelles Jahr)</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Kapazitäts-Übersicht kommt in Phase 2. API-Daten sind über{' '}
          <code>/api/energy/capacity</code> verfügbar.
        </p>
      </div>

      <div className="card">
        <h2>Erzeugungsmix</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Echtzeit-Erzeugungsdaten sind über{' '}
          <code>/api/energy/generation</code> verfügbar.
        </p>
      </div>
    </>
  );
}
