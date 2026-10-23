import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface DpoOverview {
  role: 'DPO' | 'Admin';
  gdpr_requests_total: number;
}

export default function DpoPanel() {
  const [data, setData] = useState<DpoOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiRequest('GET', '/dpo/overview')
      .then((response) => {
        if (!mounted) return;
        const overview = response?.data?.data;
        if (response?.ok && response?.data?.success === true &&
            (overview?.role === 'DPO' || overview?.role === 'Admin')) {
          setData(overview);
        } else {
          setError('Permessi DPO non disponibili.');
        }
      })
      .catch(() => {
        if (mounted) setError('Accesso non autorizzato o servizio non disponibile.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8" aria-labelledby="dpo-heading">
      <h1 id="dpo-heading" className="mb-2 text-2xl font-semibold">Pannello privacy DPO</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Area di consultazione limitata: nessun accesso alla gestione tecnica,
        alle opinioni individuali, alle credenziali o alla cancellazione dei dati.
      </p>
      {loading && <p role="status">Caricamento…</p>}
      {!loading && error && <p role="alert">{error}</p>}
      {!loading && data && (
        <section className="rounded-lg border p-5">
          <h2 className="mb-3 text-lg font-medium">Riepilogo privacy</h2>
          <p className="mb-3 text-sm">Consultazione in sola lettura come {data.role}.</p>
          <p>Richieste GDPR registrate: <strong>{data.gdpr_requests_total}</strong></p>
          <p className="mt-3 text-sm">Durate di conservazione: revisione in corso.</p>
          <p className="mt-1 text-sm">Log obbligatori: perimetro giuridico da verificare.</p>
          <p className="mt-4 text-xs text-muted-foreground">
            Il pannello mostra soltanto conteggi aggregati.
          </p>
        </section>
      )}
    </main>
  );
}
