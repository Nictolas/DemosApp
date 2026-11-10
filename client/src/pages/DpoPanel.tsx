import React, { useEffect, useState } from "react";
import {
  Activity, ArrowLeft, Bell, BookOpen, Building2, ChevronRight,
  ClipboardCheck, Info, ShieldCheck, Users,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { hasAdminCapability, hasDpoCapability } from "@/lib/admin-access";
import { Redirect, useLocation } from "wouter";

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

type AreaId = "utenti-verifiche" | "contenuti" | "comunicazioni" | "dati-istituzionali" | "ops-center" | "gdpr";

const sections = [
  { id: "utenti-verifiche", title: "Utenti e verifiche", short: "Account e riconoscimenti", icon: Users, accent: "violet" },
  { id: "contenuti", title: "Trattamenti delle opinioni", short: "Solo conteggi aggregati", icon: BookOpen, accent: "cyan" },
  { id: "comunicazioni", title: "Comunicazioni", short: "Notifiche DEMOS", icon: Bell, accent: "pink" },
  { id: "dati-istituzionali", title: "Dati istituzionali trattati", short: "Solo conteggi aggregati", icon: Building2, accent: "slate" },
  { id: "ops-center", title: "Controlli privacy", short: "Conservazione e log", icon: Activity, accent: "indigo" },
  { id: "gdpr", title: "Richieste GDPR", short: "Stato delle richieste", icon: ClipboardCheck, accent: "teal" },
] as const;

const getInitialArea = (): AreaId | null => {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("section");
  return sections.find(section => section.id === requested)?.id ?? null;
};

const displayCount = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("it-IT") : "—";

const displayDate = (value: string | null | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : "Nessuna data disponibile";

function Metric({ label, count, note }: { label: string; count: number | undefined; note?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-5 sm:py-5">
      <p className="text-xs font-medium leading-snug text-slate-600 sm:text-sm">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums sm:mt-2 sm:text-3xl">{displayCount(count)}</p>
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
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, navigate] = useLocation();
  const canViewDpo = hasAdminCapability(user) || hasDpoCapability(user);
  const [data, setData] = useState<DpoOverview | null>(null);
  const [areas, setAreas] = useState<DpoAreas | null>(null);
  const [error, setError] = useState("");
  const [areasError, setAreasError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<AreaId | null>(getInitialArea);

  // Each area is its own view and URL, not an expanding block below the tiles.
  // Back/forward navigation also restores the correct view.
  const selectArea = (area: AreaId | null) => {
    setSelectedArea(area);
    navigate(area ? "/dpo?section=" + encodeURIComponent(area) : "/dpo");
  };
  useEffect(() => {
    const restoreView = () => setSelectedArea(getInitialArea());
    window.addEventListener("popstate", restoreView);
    return () => window.removeEventListener("popstate", restoreView);
  }, []);

  useEffect(() => {
    if (isAuthLoading || !canViewDpo) return;
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
  }, [isAuthLoading, canViewDpo]);

  const selected = sections.find(section => section.id === selectedArea);
  const activeUsers = areas?.["utenti-verifiche"].users_active;
  const totalUsers = areas?.["utenti-verifiche"].users_total;
  const otherUsers = typeof activeUsers === "number" && typeof totalUsers === "number"
    ? Math.max(0, totalUsers - activeUsers) : undefined;
  const showOverview = selectedArea === null;

  if (isAuthLoading) return <main className="p-6" role="status">Verifica accesso privacy…</main>;
  if (!user) return <Redirect to="/auth" />;
  if (!canViewDpo) return <Redirect to="/preferiti" />;

  return (
    <main
      className={[
        "dpo-panel-page bg-[radial-gradient(circle_at_top_left,_#eff4ff_0%,_#f8fbff_40%,_#ffffff_90%)]",
        showOverview ? "dpo-panel-page--overview" : "dpo-panel-page--detail",
      ].join(" ")}
      aria-labelledby="dpo-heading"
    >
      <div className="dpo-panel-shell mx-auto w-full max-w-6xl">
        {showOverview ? (
          <>
            <a
              href="/gestisci"
              className="dpo-panel-back inline-flex shrink-0 items-center gap-2 rounded-lg text-sm font-semibold text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Torna a Gestisci
            </a>

            <header className="dpo-overview-header flex shrink-0 items-center gap-3 rounded-2xl border border-indigo-100 bg-white/80 p-3 shadow-sm sm:p-5">
              <div className="dpo-overview-symbol flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="dpo-overview-kicker text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  Supervisione della privacy
                </p>
                <h1 id="dpo-heading" className="text-xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-3xl">
                  Pannello privacy DPO
                </h1>
                <p className="dpo-overview-caption mt-1 text-xs leading-snug text-slate-600 sm:text-sm">
                  Sola lettura · Nessun dato individuale
                  {data?.role === "Admin" ? " · Consultazione come Admin" : ""}
                </p>
              </div>
            </header>

            <div className="dpo-overview-section-title flex shrink-0 items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">Aree di consultazione</h2>
              <span className="text-xs text-slate-500">6 aree</span>
            </div>

            {error && <p role="alert" className="shrink-0 text-sm text-rose-700">{error}</p>}
            <nav className="dpo-overview-grid" aria-label="Sezioni di consultazione DPO">
              {sections.map(section => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => selectArea(section.id)}
                    className="dpo-overview-tile group relative flex min-w-0 flex-col justify-center gap-1 rounded-2xl border border-slate-200 bg-white/90 p-3 text-left shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    aria-label={"Apri " + section.title + ": " + section.short}
                  >
                    <Icon className="dpo-tile-icon h-5 w-5 shrink-0 text-indigo-700" aria-hidden="true" />
                    <span className="dpo-tile-label block pr-3 text-sm font-bold leading-tight text-slate-900">
                      {section.title}
                    </span>
                    <span className="dpo-tile-caption block pr-3 text-[11px] leading-snug text-slate-500">
                      {section.short}
                    </span>
                    <ChevronRight className="absolute bottom-3 right-2 h-4 w-4 text-slate-400" aria-hidden="true" />
                  </button>
                );
              })}
            </nav>
            {loading && <span className="sr-only" role="status">Caricamento del riepilogo…</span>}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => selectArea(null)}
              className="dpo-panel-back inline-flex shrink-0 items-center gap-2 rounded-lg text-sm font-semibold text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Torna alle aree
            </button>

            <header className="dpo-detail-header shrink-0 rounded-2xl border border-indigo-100 bg-white/85 p-4 shadow-sm sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                Supervisione della privacy · Sola lettura
              </p>
              <h1 id="dpo-heading" className="mt-1 text-xl font-bold leading-tight text-slate-900 sm:text-3xl">
                {selected?.title}
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
                {selected?.short}. Dati aggregati, nessun dato individuale e nessuna funzione di modifica.
              </p>
            </header>

            <section id="dpo-area-detail" className="dpo-detail-content rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm sm:p-6" aria-live="polite">
              {loading && <p role="status" className="text-sm text-slate-600">Caricamento del riepilogo…</p>}
              {!loading && error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
              {!loading && data && (
                <>
                  {selected?.id !== "ops-center" && selected?.id !== "gdpr" && areasError && (
                    <p role="alert" className="mb-3 text-sm text-rose-700">{areasError}</p>
                  )}

                  {selected?.id === "gdpr" && (
                    <>
                      <div className="dpo-metrics-grid grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <Metric label="Richieste operative" count={data.gdpr_requests_total} />
                        <Metric label="In attesa" count={data.gdpr_requests_pending} />
                        <Metric label="In lavorazione" count={data.gdpr_requests_processing} />
                        <Metric label="Completate" count={data.gdpr_requests_completed} />
                      </div>
                      <NoRequests total={data.gdpr_requests_total} />
                      <p className="mt-4 text-xs leading-relaxed text-slate-600">
                        Sono esclusi {displayCount(data.gdpr_requests_migration_excluded)} record iniziali di migrazione.
                        Il registro non comprende necessariamente le richieste ricevute attraverso altri canali.
                      </p>
                    </>
                  )}

                  {selected?.id === "utenti-verifiche" && areas && (
                    <div className="dpo-metrics-grid grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <Metric label="Account registrati" count={totalUsers} />
                      <Metric label="Account attivi" count={activeUsers} />
                      <Metric label="Account non attivi" count={otherUsers} />
                      <Metric label="Riconoscimenti registrati" count={areas["utenti-verifiche"].recognitions_total} />
                      <Metric label="Riconoscimenti ultimi 30 giorni" count={areas["utenti-verifiche"].recognitions_last_30d} />
                    </div>
                  )}

                  {selected?.id === "contenuti" && areas && (
                    <div className="dpo-metrics-grid grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <Metric label="Opinioni disponibili" count={areas.contenuti.opinions_total} />
                      <Metric label="Opinioni proposte" count={areas.contenuti.proposed_opinions_total} />
                      <Metric label="Proposte ultimi 30 giorni" count={areas.contenuti.proposals_last_30d} />
                    </div>
                  )}

                  {selected?.id === "comunicazioni" && areas && (
                    <div className="dpo-metrics-grid grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <Metric label="Notifiche DEMOS registrate" count={areas.comunicazioni.notifications_total} />
                      <Metric label="Notifiche ultimi 30 giorni" count={areas.comunicazioni.notifications_last_30d} />
                      <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-5 sm:py-5">
                        <p className="text-xs font-medium leading-snug text-slate-600">Ultima notifica registrata</p>
                        <p className="mt-1 text-lg font-bold tracking-tight text-slate-900 sm:text-2xl">{displayDate(areas.comunicazioni.notifications_latest_date)}</p>
                      </div>
                    </div>
                  )}

                  {selected?.id === "dati-istituzionali" && areas && (
                    <div className="dpo-metrics-grid grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Metric label="Iniziative ministeriali" count={areas["dati-istituzionali"].ministry_initiatives_total} />
                      <Metric label="Iniziative ultimi 30 giorni" count={areas["dati-istituzionali"].initiatives_last_30d} />
                      <Metric label="Votazioni parlamentari registrate" count={areas["dati-istituzionali"].parliamentary_votes_total} />
                      <Metric label="Votazioni ultimi 30 giorni" count={areas["dati-istituzionali"].parliamentary_votes_last_30d} />
                    </div>
                  )}

                  {selected?.id === "ops-center" && (
                    <>
                      <div className="dpo-metrics-grid grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        <Metric label="Richieste GDPR operative" count={data.gdpr_requests_total} />
                        <Metric label="In attesa" count={data.gdpr_requests_pending} />
                        <Metric label="In lavorazione" count={data.gdpr_requests_processing} />
                        <Metric label="Completate" count={data.gdpr_requests_completed} />
                        <Metric label="Record iniziali esclusi" count={data.gdpr_requests_migration_excluded} note="Solo migrazione, non richieste." />
                      </div>
                      <NoRequests total={data.gdpr_requests_total} />
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-slate-800">Politica di conservazione</p>
                          <p className="mt-1 text-xs text-slate-600">{data.retention_policy === "pending_approval" ? "In revisione: durata definitiva non approvata." : "Stato da verificare nella documentazione."}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-slate-800">Perimetro dei log</p>
                          <p className="mt-1 text-xs text-slate-600">{data.log_policy === "pending_legal_scope_review" ? "Valutazione normativa ancora aperta." : "Stato da verificare nella documentazione."}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-slate-600">
                        Backup, export integrali, permessi e operazioni tecniche restano riservati all'Admin.
                      </p>
                    </>
                  )}
                </>
              )}
            </section>
            <aside className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Questi riepiloghi non certificano da soli la conformità GDPR.</span>
            </aside>
          </>
        )}
      </div>
    </main>
  );
}
