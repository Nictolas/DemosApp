import React, { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { gestisciSections } from "../constants/sections";
import { GestisciHub, gestisciHubs } from "../constants/hubs";

const hubAccent = (buttonColor: string) => {
  if (buttonColor.includes("purple")) return "#8b5cf6";
  if (buttonColor.includes("cyan")) return "#06b6d4";
  if (buttonColor.includes("pink")) return "#ec4899";
  if (buttonColor.includes("slate")) return "#64748b";
  if (buttonColor.includes("indigo")) return "#6366f1";
  return "#6b7280";
};

const hubCardClass = "gestisci-overview-card group relative flex w-full min-w-0 flex-col justify-center overflow-hidden rounded-2xl border border-white/60 bg-white/85 p-3 text-left shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-white/95 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:p-5";

export const SectionsGrid: React.FC<{ dpoReadOnly?: boolean }> = ({ dpoReadOnly = false }) => {
  const [selectedHubId, setSelectedHubId] = useState<GestisciHub["id"] | null>(null);

  const selectedHub = useMemo(
    () => gestisciHubs.find((hub) => hub.id === selectedHubId) ?? null,
    [selectedHubId],
  );
  const selectedSections = useMemo(() => {
    if (!selectedHub) return [];
    const ids = new Set(selectedHub.sectionIds);
    return gestisciSections.filter((section) => ids.has(section.id));
  }, [selectedHub]);

  const openHub = (hub: GestisciHub) => {
    if (dpoReadOnly) {
      window.location.href = `/dpo?section=${encodeURIComponent(hub.id)}`;
      return;
    }
    if (hub.route) {
      window.location.href = hub.route;
      return;
    }
    setSelectedHubId(hub.id);
  };

  if (selectedHub) {
    const SelectedHubIcon = selectedHub.icon;
    const selectedAccent = hubAccent(selectedHub.buttonColor);
    return (
      <div className="w-full space-y-5">
        <button
          type="button"
          onClick={() => setSelectedHubId(null)}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white/80 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Tutte le aree
        </button>
        <div className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${selectedAccent}20` }}
            >
              <SelectedHubIcon className="h-6 w-6" style={{ color: selectedAccent }} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{selectedHub.title}</h1>
              <p className="mt-1 text-sm text-slate-600">{selectedHub.description}</p>
            </div>
          </div>
        </div>
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {selectedSections.map((section) => <SectionCard key={section.id} section={section} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="gestisci-overview-layout">
      <header className="gestisci-overview-heading rounded-2xl border border-white/70 bg-white/75 p-3 shadow-sm backdrop-blur-sm sm:p-5">
        <h1 className="text-lg font-bold text-slate-900 sm:text-2xl">
          {dpoReadOnly ? "Consultazione DEMOS" : "Gestione DEMOS"}
        </h1>
        <p className="gestisci-overview-subtitle mt-1 text-xs leading-snug text-slate-600 sm:text-sm">
          {dpoReadOnly
            ? "Consulta le aree della privacy in sola lettura."
            : "Utenti, proposte, notifiche, dati istituzionali e sicurezza."}
        </p>
      </header>

      <nav className="gestisci-overview-grid" aria-label="Aree di Gestione DEMOS">
        <button
          type="button"
          onClick={() => { window.location.href = "/dpo"; }}
          className={hubCardClass}
          data-testid="gestisci-dpo"
          aria-label="Apri Pannello DPO"
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-indigo-600" />
          <div className="gestisci-overview-card__icon mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 sm:h-12 sm:w-12">
            <ShieldCheck className="h-6 w-6 text-indigo-700" aria-hidden="true" />
          </div>
          <div className="min-w-0 pr-2">
            <div className="gestisci-overview-card__title text-sm font-semibold leading-tight text-slate-900 sm:text-base">Pannello DPO</div>
            <div className="gestisci-overview-card__description mt-1 text-[11px] leading-snug text-slate-600 sm:text-xs">
              Privacy, richieste GDPR e consultazione in sola lettura.
            </div>
          </div>
          <ChevronRight className="absolute bottom-4 right-4 h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700" aria-hidden="true" />
        </button>

        {gestisciHubs.map((hub) => {
          const Icon = hub.icon;
          const accent = hubAccent(hub.buttonColor);
          return (
            <button
              key={hub.id}
              type="button"
              onClick={() => openHub(hub)}
              className={hubCardClass}
              data-testid={`gestisci-hub-${hub.id}`}
            >
              <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: accent }} />
              <div
                className="gestisci-overview-card__icon mb-2 flex h-10 w-10 items-center justify-center rounded-xl sm:h-12 sm:w-12"
                style={{ backgroundColor: `${accent}20` }}
              >
                <Icon className="h-6 w-6" style={{ color: accent }} aria-hidden="true" />
              </div>
              <div className="min-w-0 pr-2">
                <div className="gestisci-overview-card__title text-sm font-semibold leading-tight text-slate-900 sm:text-base">{hub.title}</div>
                <div className="gestisci-overview-card__description mt-1 text-[11px] leading-snug text-slate-600 sm:text-xs">
                  {dpoReadOnly ? "Riepilogo aggregato in sola lettura" : hub.description}
                </div>
              </div>
              <ChevronRight className="absolute bottom-4 right-4 h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700" aria-hidden="true" />
            </button>
          );
        })}
      </nav>
    </div>
  );
};
