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

import ErzeugungDashboard from '@/components/dashboards/ErzeugungDashboard';

export default function ErzeugungPage() {
  return (
    <>
      <h2 style={{ margin: '1rem 0' }}>Stromerzeugung & Kapazitäten</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Installierte Erzeugungskapazitäten und aktueller Erzeugungsmix in
        Deutschland. Datenquellen: ENTSO-E, Netztransparenz.de.
      </p>

      <ErzeugungDashboard />
    </>
  );
}
