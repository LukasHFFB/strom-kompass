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

import PriceDashboard from '@/components/dashboards/PriceDashboard';

export default function StrompreisPage() {
  return (
    <>
      <h2 style={{ margin: '1rem 0' }}>Strompreis Deutschland</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Aktueller Day-Ahead Börsenstrompreis (EPEX Spot, Gebotszone DE-LU) und
        historischer Verlauf. Datenquelle: ENTSO-E Transparency Platform.
      </p>

      <PriceDashboard />
    </>
  );
}
