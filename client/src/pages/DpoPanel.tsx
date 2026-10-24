import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import {
  Activity, ArrowLeft, Bell, BookOpen, Building2, CheckCircle2,
  ChevronRight, Clock3, Eye, ShieldCheck, Users
} from 'lucide-react';

interface DpoOverview {
  role: 'DPO' | 'Admin';
  gdpr_requests_total: number;
  gdpr_requests_pending: number;
  gdpr_requests_processing: number;
  gdpr_requests_completed: number;
  gdpr_requests_migration_excluded: number;
  rights_counter_scope: 'user_rights_requests_excluding_migration_seed';
  retention_policy?: string;
  log_policy?: string;
}

interface DpoAreas {
  scope: 'aggregated_readonly';
  'utenti-verifiche': {
    users_total: number; users_active: number; users_recent: number;
    recognitions_total: number; recognitions_recent: number
  };
  contenuti: {
    opinions_total: number; opinions_with_detail: number;
    proposed_opinions_total: number; proposed_opinions_recent: number
  };
  comunicazioni: {
    notifications_total: number; notifications_recent: number;
    notifications_latest_at: string | null
  };
  'dati-istituzionali': {
    ministry_initiatives_total: number; ministry_initiatives_not_ended: number;
    ministry_last_updated_at: string | null; parliamentary_votes_total: number
  };
  'ops-center': { access: 'privacy_oversight_only' };
}

type AreaId = 'utenti-verifiche' | 'contenuti' | 'comunicazioni' | 'dati-istituzionali' | 'ops-center';

const sections = [
  { id: 'utenti-verifiche', title: 'Utenti e verifiche', description: 'Account e riconoscimenti', icon: Users, accent: 'text-violet-700 bg-violet-100' },
  { id: 'contenuti', title: 'Contenuti', description: 'Opinioni e proposte', icon: BookOpen, accent: 'text-cyan-700 bg-cyan-100' },
  { id: 'comunicazioni', title: 'Comunicazioni', description: 'Notifiche e invii', icon: Bell, accent: 'text-pink-700 bg-pink-100' },
  { id: 'dati-istituzionali', title: 'Dati istituzionali', description: 'Iniziative e votazioni', icon: Building2, accent: 'text-slate-700 bg-slate-100' },
  { id: 'ops-center', title: 'Ops Center', description: 'Supervisione privacy', icon: Activity, accent: 'text-indigo-700 bg-indigo-100' }
] as const;

const getInitialArea = (): AreaId | null => {
  const requested = new URLSearchParams(window.location.search).get('section');
  return sections.find((section) => section.id === requested)?.id ?? null;
};

const displayCount = (value: number | undefined) =>
  Number.isFinite(value) ? Number(value).toLocaleString('it-IT') : '—';

const displayDate = (value: string | null | undefined) => {
  if (!value) return 'Non disponibile';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Non disponibile' :
    new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

function Metric({ label, count, note }: { label: string; count: number | undefined; note?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{displayCount(count)}</p>
      {note && <p className="mt-2 text-xs leading-relaxed text-slate-500">{note}</p>}
    </div>
  );
}

function DateMetric({ label, date }: { label: string; date: string | null | undefined }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-3 text-lg font-semibold text-slate-900">{displayDate(date)}</p>
      <p className="mt-2 text-xs text-slate-500">Data dell'ultimo evento registrato</p>
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
  const SelectedIcon = selected?.icon ?? ShieldCheck;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#eef4ff_0%,_#f8fbff_42%,_#ffffff_78%)]" aria-labelledby="dpo-heading">
      <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-6 sm:px-6 lg:px-8">
        <a href="/gestisci" className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Torna a Gestisci
        </a>

        <header className="rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <ShieldCheck className="h-7 w-7" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-violet-700">Supervisione · DEMOS</p>
                <h1 id="dpo-heading" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Pannello privacy DPO</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  Richieste GDPR e informazioni aggregate, organizzate per area. Nessun dato relativo a voti o opinioni individuali.
                </p>
              </div>
            </div>
            {!loading && data && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-700">
                  {data.role === 'Admin' ? 'Consultazione come Admin' : 'Ruolo DPO'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-2 text-violet-800">
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Sola lettura
                </span>
              </div>
            )}
          </div>
        </header>

        {loading && <p role="status" className="mt-6 text-sm text-slate-600">Caricamento dei riepiloghi…</p>}
        {!loading && error && <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-700">{error}</p>}

        {!loading && data && (
          <>
            <section className="mt-7" aria-label="Aree di consultazione">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Esplora le aree</h2>
                <span className="text-xs text-slate-500">Cinque sezioni · solo consultazione</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const active = selectedArea === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setSelectedArea(section.id)}
                      aria-pressed={active}
                      className={'group relative min-h-[140px] rounded-2xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ' +
                        (active ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-300' : 'border-slate-200 bg-white hover:border-slate-300')}
                    >
                      <span className={'mb-3 flex h-10 w-10 items-center justify-center rounded-xl ' + section.accent}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="block pr-4 text-sm font-semibold text-slate-900">{section.title}</span>
                      <span className="mt-1 block text-xs text-slate-600">{section.description}</span>
                      <ChevronRight className="absolute bottom-4 right-3.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-7 rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm sm:p-7" aria-live="polite">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                    <SelectedIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{selected?.title ?? 'Riepilogo privacy'}</h2>
                    <p className="mt-1 text-sm text-slate-600">{selected?.description ?? 'Stato delle richieste GDPR registrate nel sistema'}</p>
                  </div>
                </div>
                {selected && (
                  <button type="button" onClick={() => setSelectedArea(null)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                    Riepilogo generale
                  </button>
                )}
              </div>

              {areasError && selectedArea !== 'ops-center' && selectedArea !== null && (
                <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{areasError}</p>
              )}

              {(selectedArea === null || selectedArea === 'ops-center') && (
                <>
                  {data.gdpr_requests_total === 0 && (
                    <div className="mb-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Nessuna richiesta GDPR operativa registrata</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">Le righe di migrazione sono escluse dal conteggio: questo dato non copre necessariamente richieste ricevute tramite altri canali.</p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric label="Richieste GDPR operative" count={data.gdpr_requests_total} />
                    <Metric label="In attesa" count={data.gdpr_requests_pending} />
                    <Metric label="In lavorazione" count={data.gdpr_requests_processing} />
                    <Metric label="Completate" count={data.gdpr_requests_completed} />
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Conservazione dei dati</p>
                        <p className="mt-1 text-sm text-slate-600">Politiche di retention in revisione. Il riepilogo non certifica la conformità.</p>
                      </div>
                    </div>
                    <div className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Ambito degli accessi</p>
                        <p className="mt-1 text-sm text-slate-600">Non sono disponibili gestione tecnica, modifica dei permessi, backup o esportazione integrale dei dati.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedArea === 'utenti-verifiche' && areas && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Account registrati" count={areas['utenti-verifiche'].users_total} />
                  <Metric label="Account attivi" count={areas['utenti-verifiche'].users_active} />
                  <Metric label="Nuovi account · 30 giorni" count={areas['utenti-verifiche'].users_recent} />
                  <Metric label="Richieste di riconoscimento" count={areas['utenti-verifiche'].recognitions_total} />
                  <Metric label="Riconoscimenti recenti · 30 giorni" count={areas['utenti-verifiche'].recognitions_recent} />
                </div>
              )}

              {selectedArea === 'contenuti' && areas && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Opinioni disponibili" count={areas.contenuti.opinions_total} />
                  <Metric label="Opinioni con approfondimento" count={areas.contenuti.opinions_with_detail} />
                  <Metric label="Opinioni proposte registrate" count={areas.contenuti.proposed_opinions_total} />
                  <Metric label="Proposte recenti · 30 giorni" count={areas.contenuti.proposed_opinions_recent} />
                </div>
              )}

              {selectedArea === 'comunicazioni' && areas && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Metric label="Notifiche DEMOS registrate" count={areas.comunicazioni.notifications_total}
                    note="Eventi presenti nella tabella notifiche, non attestazione di consegna push." />
                  <Metric label="Registrate · ultimi 30 giorni" count={areas.comunicazioni.notifications_recent} />
                  <DateMetric label="Ultima notifica registrata" date={areas.comunicazioni.notifications_latest_at} />
                </div>
              )}

              {selectedArea === 'dati-istituzionali' && areas && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Iniziative ministeriali" count={areas['dati-istituzionali'].ministry_initiatives_total} />
                  <Metric label="Iniziative non ancora scadute" count={areas['dati-istituzionali'].ministry_initiatives_not_ended}
                    note="Calcolate dalla data di fine, senza verificare lo stato ufficiale." />
                  <Metric label="Votazioni parlamentari" count={areas['dati-istituzionali'].parliamentary_votes_total} />
                  <DateMetric label="Ultimo aggiornamento iniziative" date={areas['dati-istituzionali'].ministry_last_updated_at} />
                </div>
              )}
            </section>

            <p className="mt-5 text-xs leading-relaxed text-slate-600">
              I dati mostrati sono aggregati. I conteggi GDPR escludono {displayCount(data.gdpr_requests_migration_excluded)} record iniziali di migrazione
              e non rappresentano necessariamente richieste ricevute da altri canali. Il pannello non contiene voti o opinioni individuali.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
