import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface DpoOverview {
  role: 'DPO' | 'Admin';
  gdpr_requests_total: number;
  gdpr_requests_pending: number;
  gdpr_requests_processing: number;
  gdpr_requests_completed: number;
  gdpr_requests_migration_excluded: number;
  rights_counter_scope: 'user_rights_requests_excluding_migration_seed';
}

interface DpoAreas {
  scope: 'aggregated_readonly';
  'utenti-verifiche': { users_total: number; users_active: number; recognitions_total: number };
  contenuti: { opinions_total: number; proposed_opinions_total: number };
  comunicazioni: { notifications_total: number };
  'dati-istituzionali': { ministry_initiatives_total: number; parliamentary_votes_total: number };
  'ops-center': { access: 'privacy_oversight_only' };
}

type AreaId = 'utenti-verifiche' | 'contenuti' | 'comunicazioni' | 'dati-istituzionali' | 'ops-center';

const sections: { id: AreaId; title: string; description: string }[] = [
  { id: 'utenti-verifiche', title: 'Utenti e verifiche', description: 'Utenti registrati e richieste di riconoscimento' },
  { id: 'contenuti', title: 'Contenuti', description: 'Opinioni disponibili e proposte' },
  { id: 'comunicazioni', title: 'Comunicazioni', description: 'Volume delle notifiche DEMOS' },
  { id: 'dati-istituzionali', title: 'Dati istituzionali', description: 'Iniziative ministeriali e votazioni parlamentari' },
  { id: 'ops-center', title: 'Ops Center', description: 'Riepilogo privacy, senza strumenti di amministrazione tecnica' }
];

const getInitialArea = (): AreaId | null => {
  const requested = new URLSearchParams(window.location.search).get('section');
  return sections.find((section) => section.id === requested)?.id ?? null;
};

const displayCount = (value: number | undefined) =>
  Number.isFinite(value) ? Number(value).toLocaleString('it-IT') : '—';

function Metric({ label, count }: { label: string; count: number | undefined }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{displayCount(count)}</p>
    </div>
  );
}

export default function DpoPanel() {
  const [data, setData] = useState<DpoOverview | null>(null);
  const [areas, setAreas] = useState<DpoAreas | null>(null);
  const [error, setError] = useState('');
  const [areasError, setAreasError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<AreaId | null>(getInitialArea);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([apiRequest('GET', '/dpo/overview'), apiRequest('GET', '/dpo/areas')])
      .then(([overview, areasResponse]) => {
        if (!mounted) return;
        if (overview.status === 'fulfilled' &&
            overview.value?.ok && overview.value?.data?.success === true &&
            (overview.value.data.data?.role === 'DPO' || overview.value.data.data?.role === 'Admin')) {
          setData(overview.value.data.data);
        } else {
          setError('Accesso non autorizzato o riepilogo privacy non disponibile.');
        }
        if (areasResponse.status === 'fulfilled' &&
            areasResponse.value?.ok && areasResponse.value?.data?.success === true &&
            areasResponse.value.data.data?.scope === 'aggregated_readonly') {
          setAreas(areasResponse.value.data.data);
        } else {
          setAreasError('I dati aggregati delle aree non sono disponibili.');
        }
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const selected = sections.find((section) => section.id === selectedArea);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8" aria-labelledby="dpo-heading">
      <a href="/gestisci" className="text-sm font-medium text-indigo-700 hover:underline">← Torna a Gestisci</a>
      <h1 id="dpo-heading" className="mt-4 text-2xl font-semibold">Pannello privacy DPO</h1>
      <p className="mb-5 mt-2 text-sm text-slate-600">
        Consultazione in sola lettura. Nessuna modifica di utenti, contenuti, notifiche,
        configurazioni, credenziali o backup; nessun accesso a opinioni o voti individuali.
      </p>
      {loading && <p role="status">Caricamento…</p>}
      {!loading && error && <p role="alert" className="mb-4 text-rose-700">{error}</p>}
      {!loading && data && (
        <>
          <p className="mb-4 text-sm text-slate-600">
            Accesso autorizzato come <strong>{data.role}</strong>.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Aree di consultazione">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedArea(section.id)}
                aria-pressed={selectedArea === section.id}
                className={`rounded-xl border p-3 text-left text-sm font-semibold transition-colors ${selectedArea === section.id
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {section.title}
                <span className="mt-1 block text-xs font-normal text-slate-500">Sola lettura</span>
              </button>
            ))}
          </div>
          {!selected && (
            <section className="mt-6 rounded-xl border bg-white p-5">
              <h2 className="text-lg font-semibold">Riepilogo privacy</h2>
              <p className="mt-2 text-sm text-slate-600">
                Seleziona un'area per vedere i suoi indicatori aggregati. Nessun accesso alle schermate amministrative.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Metric label="Richieste GDPR operative" count={data.gdpr_requests_total} />
                <Metric label="In attesa" count={data.gdpr_requests_pending} />
                <Metric label="In lavorazione" count={data.gdpr_requests_processing} />
              </div>
            </section>
          )}
          {selected && (
            <section className="mt-6 rounded-xl border bg-white p-5" aria-live="polite">
              <h2 className="text-lg font-semibold">{selected.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{selected.description}. Solo dati aggregati.</p>
              {areasError && selected.id !== 'ops-center' && (
                <p role="alert" className="mt-4 text-sm text-rose-700">{areasError}</p>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {selected.id === 'utenti-verifiche' && areas && (
                  <>
                    <Metric label="Account registrati" count={areas['utenti-verifiche'].users_total} />
                    <Metric label="Account attivi" count={areas['utenti-verifiche'].users_active} />
                    <Metric label="Richieste di riconoscimento registrate" count={areas['utenti-verifiche'].recognitions_total} />
                  </>
                )}
                {selected.id === 'contenuti' && areas && (
                  <>
                    <Metric label="Opinioni disponibili" count={areas.contenuti.opinions_total} />
                    <Metric label="Opinioni proposte" count={areas.contenuti.proposed_opinions_total} />
                  </>
                )}
                {selected.id === 'comunicazioni' && areas && (
                  <Metric label="Notifiche DEMOS registrate" count={areas.comunicazioni.notifications_total} />
                )}
                {selected.id === 'dati-istituzionali' && areas && (
                  <>
                    <Metric label="Iniziative ministeriali" count={areas['dati-istituzionali'].ministry_initiatives_total} />
                    <Metric label="Votazioni parlamentari registrate" count={areas['dati-istituzionali'].parliamentary_votes_total} />
                  </>
                )}
                {selected.id === 'ops-center' && (
                  <>
                    <Metric label="Richieste GDPR operative" count={data.gdpr_requests_total} />
                    <Metric label="In attesa" count={data.gdpr_requests_pending} />
                    <Metric label="In lavorazione" count={data.gdpr_requests_processing} />
                    <Metric label="Completate" count={data.gdpr_requests_completed} />
                  </>
                )}
              </div>
              {selected.id === 'ops-center' && (
                <p className="mt-4 text-sm text-slate-600">
                  Per la supervisione privacy non sono disponibili gestione server, esportazione integrale dei dati,
                  ripristino backup, modifiche ai permessi o comandi tecnici.
                </p>
              )}
            </section>
          )}
          <p className="mt-5 text-xs text-slate-600">
            I conteggi delle richieste GDPR escludono i record iniziali di migrazione
            ({displayCount(data.gdpr_requests_migration_excluded)}). Non attestano tutti i canali
            di esercizio dei diritti, né la conformità delle politiche di conservazione.
          </p>
        </>
      )}
    </main>
  );
}
