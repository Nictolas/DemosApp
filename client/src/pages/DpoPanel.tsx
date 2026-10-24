import React, { useEffect, useState } from "react";
import {
  Activity, ArrowLeft, Bell, BookOpen, Building2, ChevronRight,
  ClipboardCheck, Eye, Info, LockKeyhole, ShieldCheck, Users,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface DpoOverview {
  role: "DPO" | "Admin";
  gdpr_requests_total: number;
  gdpr_requests_pending: number;
  gdpr_requests_processing: number;
  gdpr_requests_completed: number;
  gdpr_requests_migration_excluded: number;
  rights_counter_scope: "user_rights_requests_excluding_migration_seed";
  retention_policy?: string;
  log_policy?: string;
}

interface DpoAreas {
  scope: "aggregated_readonly";
  "utenti-verifiche": {
    users_total: number; users_active: number; recognitions_total: number;
    recognitions_last_30d: number;
  };
  contenuti: {
    opinions_total: number; proposed_opinions_total: number; proposals_last_30d: number;
  };
  comunicazioni: { notifications_total: number; notifications_last_30d: number; notifications_latest_date: string | null };
  "dati-istituzionali": {
    ministry_initiatives_total: number; initiatives_last_30d: number;
    parliamentary_votes_total: number; parliamentary_votes_last_30d: number;
  };
  "ops-center": { access: "privacy_oversight_only" };
}

type AreaId = "utenti-verifiche" | "contenuti" | "comunicazioni" | "dati-istituzionali" | "ops-center";

const sections = [
  { id: "utenti-verifiche", title: "Utenti e verifiche", short: "Account e riconoscimenti", icon: Users, accent: "violet" },
  { id: "contenuti", title: "Contenuti", short: "Opinioni e proposte", icon: BookOpen, accent: "cyan" },
  { id: "comunicazioni", title: "Comunicazioni", short: "Notifiche DEMOS", icon: Bell, accent: "pink" },
  { id: "dati-istituzionali", title: "Dati istituzionali", short: "Iniziative e Parlamento", icon: Building2, accent: "slate" },
  { id: "ops-center", title: "Ops Center", short: "Supervisione privacy", icon: Activity, accent: "indigo" },
] as const;

const getInitialArea = (): AreaId | null => {
  if (typeof window === "undefined") return "ops-center";
  const requested = new URLSearchParams(window.location.search).get("section");
  return sections.find(section => section.id === requested)?.id ?? "ops-center";
};

const displayCount = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("it-IT") : "—";

const displayDate = (value: string | null | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : "Nessuna data disponibile";

function Metric({ label, count, note }: { label: string; count: number | undefined; note?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{displayCount(count)}</p>
      {note && <p className="mt-2 text-xs leading-relaxed text-slate-500">{note}</p>}
    </div>
  );
}

function NoRequests({ total }: { total: number }) {
  if (total !== 0) return null;
  return (
    <div className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
      <p>Nessuna richiesta operativa presente in questo registro. Il dato non copre necessariamente richieste ricevute attraverso altri canali.</p>
    </div>
  );
}

export default function DpoPanel() {
  const [data, setData] = useState<DpoOverview | null>(null);
  const [areas, setAreas] = useState<DpoAreas | null>(null);
  const [error, setError] = useState("");
  const [areasError, setAreasError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<AreaId | null>(getInitialArea);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([apiRequest("GET", "/dpo/overview"), apiRequest("GET", "/dpo/areas")])
      .then(([overview, areaResponse]) => {
        if (!mounted) return;
        if (
          overview.status === "fulfilled" &&
          overview.value?.ok && overview.value?.data?.success === true &&
          (overview.value.data.data?.role === "DPO" || overview.value.data.data?.role === "Admin")
        ) {
          setData(overview.value.data.data);
        } else {
          setError("Accesso non autorizzato o riepilogo privacy non disponibile.");
        }

        if (
          areaResponse.status === "fulfilled" &&
          areaResponse.value?.ok && areaResponse.value?.data?.success === true &&
          areaResponse.value.data.data?.scope === "aggregated_readonly"
        ) {
          setAreas(areaResponse.value.data.data);
        } else {
          setAreasError("Gli indicatori delle aree non sono disponibili in questo momento.");
        }
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const selected = sections.find(section => section.id === selectedArea);
  const activeUsers = areas?.["utenti-verifiche"].users_active;
  const totalUsers = areas?.["utenti-verifiche"].users_total;
  const otherUsers = typeof activeUsers === "number" && typeof totalUsers === "number"
    ? Math.max(0, totalUsers - activeUsers) : undefined;
  const showOverview = selectedArea === null;

  return (
    <main className="min-h-[calc(100vh-10rem)] bg-[radial-gradient(circle_at_top_left,_#eff4ff_0%,_#f8fbff_40%,_#ffffff_90%)] px-4 pb-16 pt-6 sm:px-6 lg:pt-9" aria-labelledby="dpo-heading">
      <div className="mx-auto w-full max-w-6xl">
        <a href="/gestisci" className="inline-flex items-center gap-2 rounded-lg px-1 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:text-indigo-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Torna a Gestisci
        </a>

        <header className="mt-3 overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-slate-50 p-5 shadow-sm sm:p-7 lg:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                <ShieldCheck className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Supervisione della privacy</p>
                <h1 id="dpo-heading" className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Pannello privacy DPO
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  Riepiloghi verificabili dei dati e delle richieste GDPR. Le funzioni sono esclusivamente di consultazione.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end lg:max-w-[360px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Sola lettura
              </span>
              {data && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                  <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                  {data.role === "Admin" ? "Consultazione come Admin" : "Accesso DPO"}
                </span>
              )}
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                Nessun voto individuale
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                Nessun comando tecnico
              </span>
            </div>
          </div>
        </header>

        {loading && <p role="status" className="mt-6 rounded-xl border bg-white p-5 text-slate-600">Caricamento del riepilogo…</p>}
        {!loading && error && <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-white p-5 text-rose-700">{error}</p>}

        {!loading && data && (
          <>
            <nav className="mt-7" aria-label="Sezioni di consultazione DPO">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">Aree di consultazione</h2>
                {!showOverview && (
                  <button
                    type="button"
                    onClick={() => setSelectedArea(null)}
                    className="text-sm font-semibold text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    Torna alla panoramica
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {sections.map(section => {
                  const Icon = section.icon;
                  const isActive = selectedArea === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setSelectedArea(section.id)}
                      aria-pressed={isActive}
                      className={`group relative min-h-[120px] rounded-2xl border p-4 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isActive ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200" : "border-slate-200 bg-white hover:border-indigo-200"}`}
                    >
                      <Icon className={`mb-3 h-6 w-6 ${isActive ? "text-indigo-700" : "text-slate-600"}`} aria-hidden="true" />
                      <span className="block pr-4 text-sm font-bold text-slate-900">{section.title}</span>
                      <span className="mt-1 block text-xs leading-snug text-slate-500">{section.short}</span>
                      <ChevronRight className="absolute bottom-4 right-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </nav>

            <section className="mt-7 rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-sm sm:p-6" aria-live="polite">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">{showOverview ? "Panoramica" : "Dettaglio aggregato"}</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                  {showOverview ? "Richieste GDPR" : selected?.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {showOverview
                    ? "Stato delle richieste presenti nel registro operativo. I record iniziali di migrazione non sono conteggiati."
                    : selected?.short + ". Nessuna informazione individuale o comando di modifica."}
                </p>
              </div>

              {showOverview && (
                <>
                  <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
                    <Metric label="Richieste operative" count={data.gdpr_requests_total} />
                    <Metric label="In attesa" count={data.gdpr_requests_pending} />
                    <Metric label="In lavorazione" count={data.gdpr_requests_processing} />
                    <Metric label="Completate" count={data.gdpr_requests_completed} />
                  </div>
                  <NoRequests total={data.gdpr_requests_total} />
                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <h3 className="text-base font-bold text-slate-900">DEMOS in sintesi</h3>
                    <p className="mt-1 mb-3 text-xs text-slate-500">Indicatori aggregati, aggiornati all'apertura del pannello.</p>
                    {areasError && <p role="alert" className="mb-3 text-sm text-rose-700">{areasError}</p>}
                    {areas && (
                      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
                        <Metric label="Account attivi" count={areas["utenti-verifiche"].users_active} />
                        <Metric label="Opinioni disponibili" count={areas.contenuti.opinions_total} />
                        <Metric label="Iniziative ministeriali" count={areas["dati-istituzionali"].ministry_initiatives_total} />
                      </div>
                    )}
                  </div>
                </>
              )}

              {!showOverview && selected?.id !== "ops-center" && areasError && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{areasError}</p>
              )}

              {selected?.id === "utenti-verifiche" && areas && (
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
                  <Metric label="Account registrati" count={totalUsers} />
                  <Metric label="Account attivi" count={activeUsers} />
                  <Metric label="Account non attivi" count={otherUsers} />
                  <Metric label="Riconoscimenti registrati" count={areas["utenti-verifiche"].recognitions_total} />
                  <Metric label="Riconoscimenti inseriti negli ultimi 30 giorni" count={areas["utenti-verifiche"].recognitions_last_30d} />
                </div>
              )}

              {selected?.id === "contenuti" && areas && (
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
                  <Metric label="Opinioni disponibili" count={areas.contenuti.opinions_total} />
                  <Metric label="Opinioni proposte" count={areas.contenuti.proposed_opinions_total} />
                  <Metric label="Proposte inserite negli ultimi 30 giorni" count={areas.contenuti.proposals_last_30d} />
                </div>
              )}

              {selected?.id === "comunicazioni" && areas && (
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
                  <Metric label="Notifiche DEMOS registrate" count={areas.comunicazioni.notifications_total} />
                  <Metric label="Notifiche datate negli ultimi 30 giorni" count={areas.comunicazioni.notifications_last_30d} />
                  <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-600">Ultima notifica registrata</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{displayDate(areas.comunicazioni.notifications_latest_date)}</p>
                  </div>
                </div>
              )}

              {selected?.id === "dati-istituzionali" && areas && (
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
                  <Metric label="Iniziative ministeriali" count={areas["dati-istituzionali"].ministry_initiatives_total} />
                  <Metric label="Iniziative inserite negli ultimi 30 giorni" count={areas["dati-istituzionali"].initiatives_last_30d} />
                  <Metric label="Votazioni parlamentari registrate" count={areas["dati-istituzionali"].parliamentary_votes_total} />
                  <Metric label="Votazioni inserite negli ultimi 30 giorni" count={areas["dati-istituzionali"].parliamentary_votes_last_30d} />
                </div>
              )}

              {selected?.id === "ops-center" && (
                <>
                  <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    <Metric label="Richieste GDPR operative" count={data.gdpr_requests_total} />
                    <Metric label="In attesa" count={data.gdpr_requests_pending} />
                    <Metric label="In lavorazione" count={data.gdpr_requests_processing} />
                    <Metric label="Completate" count={data.gdpr_requests_completed} />
                    <Metric label="Record iniziali esclusi" count={data.gdpr_requests_migration_excluded} note="Dati tecnici di migrazione, non richieste operative." />
                  </div>
                  <NoRequests total={data.gdpr_requests_total} />
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-800">Politica di conservazione</p>
                      <p className="mt-1 text-sm text-slate-600">{data.retention_policy === "pending_approval" ? "In revisione: nessuna durata definitiva attestata." : "Stato da verificare nella documentazione."}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-800">Perimetro dei log</p>
                      <p className="mt-1 text-sm text-slate-600">{data.log_policy === "pending_legal_scope_review" ? "Valutazione normativa ancora aperta." : "Stato da verificare nella documentazione."}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-600">
                    Le operazioni tecniche, i backup, gli export integrali e le modifiche ai permessi restano riservati all'amministratore.
                  </p>
                </>
              )}
            </section>

            <aside className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 sm:p-5">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
              <p>
                Sono mostrati solo dati aggregati, senza opinioni o voti individuali.
                I conteggi GDPR escludono {displayCount(data.gdpr_requests_migration_excluded)} record iniziali di migrazione.
                Il registro potrebbe non includere richieste ricevute attraverso altri canali e non certifica da solo la conformità delle politiche di conservazione.
              </p>
            </aside>
          </>
        )}
      </div>
    </main>
  );
}
