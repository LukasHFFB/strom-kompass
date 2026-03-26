'use client';

import { useState, useEffect } from 'react';

interface DbStatus {
  counts: {
    prices: number;
    generation: number;
    forecasts: number;
    capacity: number;
  };
  recent: {
    prices: any[];
    generation: any[];
    forecasts: any[];
    capacity: any[];
  };
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [status, setStatus] = useState<DbStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/db-status', {
        headers: { 'x-admin-password': password },
      });

      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setIsAuth(true);
        // Save to session storage for convenience during the session
        sessionStorage.setItem('admin-pass', password);
      } else {
        setError('Ungültiges Passwort');
      }
    } catch (err) {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pass');
    if (saved) {
      setPassword(saved);
      // Auto-login if we have a saved password
      const fakeEvent = { preventDefault: () => {} } as any;
      handleLogin(fakeEvent);
    }
  }, []);

  if (!isAuth) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '2rem' }}>Admin Login</h1>
        <form onSubmit={handleLogin} className="card">
          <input
            type="password"
            placeholder="Passwort eingeben..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginBottom: '1rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {loading ? 'Prüfe...' : 'Anmelden'}
          </button>
          {error && <p style={{ color: 'var(--red)', marginTop: '1rem', fontSize: '0.9rem' }}>{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Datenbank-Inspektor</h1>
        <button
          onClick={() => {
            sessionStorage.removeItem('admin-pass');
            window.location.reload();
          }}
          style={{ fontSize: '0.8rem', color: 'var(--red)', cursor: 'pointer', background: 'none', border: 'none' }}
        >
          Logout
        </button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '3rem' }}>
        <StatCard label="Preise" count={status?.counts.prices} />
        <StatCard label="Erzeugung" count={status?.counts.generation} />
        <StatCard label="Prognosen" count={status?.counts.forecasts} />
        <StatCard label="Kapazität" count={status?.counts.capacity} />
      </div>

      <Section title="Letzte Preisdaten" data={status?.recent.prices} columns={['timestamp', 'price', 'source']} />
      <Section title="Letzte Erzeugungsdaten" data={status?.recent.generation} columns={['timestamp', 'energyType', 'value', 'source']} />
      <Section title="Letzte Prognosedaten" data={status?.recent.forecasts} columns={['timestamp', 'energyType', 'value', 'source']} />
      <Section title="Installierte Kapazitäten" data={status?.recent.capacity} columns={['date', 'energyType', 'value', 'source']} />
    </div>
  );
}

function StatCard({ label, count }: { label: string; count?: number }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
      <h2 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{label}</h2>
      <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{count?.toLocaleString() ?? '—'}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Einträge gesamt</div>
    </div>
  );
}

function Section({ title, data, columns }: { title: string; data?: any[]; columns: string[] }) {
  return (
    <div className="card" style={{ marginBottom: '2rem', overflowX: 'auto' }}>
      <h2 style={{ marginBottom: '1rem', color: 'var(--text)' }}>{title}</h2>
      <table className="data-table" style={{ width: '100%', minWidth: '600px' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data?.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col} style={{ fontSize: '0.8rem' }}>
                  {typeof row[col] === 'object' && row[col] !== null
                    ? new Date(row[col]).toLocaleString()
                    : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
          {(!data || data.length === 0) && (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Keine Daten vorhanden
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
