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
  if (buttonColor.includes("violet")) return "#7c3aed";
  return "#6b7280";
};

type DpoHub = {
  id: "dpo";
  title: string;
  description: string;
  icon: typeof ShieldCheck;
  buttonColor: string;
  sectionIds: string[];
  route: string;
};

const overviewHubs: Array<DpoHub | GestisciHub> = [
  {
    id: "dpo",
    title: "Pannello DPO",
    description: "Privacy, richieste GDPR e supervisione in sola lettura.",
    icon: ShieldCheck,
    buttonColor: "bg-violet-600 hover:bg-violet-700",
    sectionIds: [],
    route: "/dpo",
  },
  ...gestisciHubs,
];

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

  const openHub = (hub: DpoHub | GestisciHub) => {
    if (hub.id === "dpo") {
      window.location.href = "/dpo";
      return;
    }
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
          <ArrowLeft className="h-4 w-4" />
          Tutte le aree
        </button>

        <div className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${selectedAccent}20` }}
            >
              <SelectedHubIcon className="h-6 w-6" style={{ color: selectedAccent }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{selectedHub.title}</h1>
              <p className="mt-1 text-sm text-slate-600">{selectedHub.description}</p>
            </div>
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {selectedSections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <div className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur-sm">
        <h1 className="text-2xl font-bold text-slate-900">{dpoReadOnly ? 'Consultazione DEMOS' : 'Gestione DEMOS'}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          {dpoReadOnly
            ? 'Le cinque aree e il pannello privacy mostrano un riepilogo aggregato in sola lettura. Nessun accesso ai comandi amministrativi o alle configurazioni tecniche.'
            : 'Le funzioni amministrative sono raccolte in cinque aree, con il Pannello DPO per la supervisione della privacy. Gli strumenti tecnici sono nell’Ops Center.'}
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {overviewHubs.map((hub) => {
          const Icon = hub.icon;
          const accent = hubAccent(hub.buttonColor);

          return (
            <button
              key={hub.id}
              type="button"
              onClick={() => openHub(hub)}
              className="group relative min-h-[170px] overflow-hidden rounded-2xl border border-white/60 bg-white/75 p-5 text-left shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              data-testid={hub.id === "dpo" ? "gestisci-dpo" : `gestisci-hub-${hub.id}`}
              aria-label={hub.id === "dpo" ? "Apri Pannello DPO" : undefined}
            >
              <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: accent }} />
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accent}20` }}
              >
                <Icon className="h-6 w-6" style={{ color: accent }} />
              </div>
              <div className="pr-5">
                <div className="font-semibold leading-tight text-slate-900">{hub.title}</div>
                <div className="mt-2 text-xs leading-snug text-slate-600">{dpoReadOnly && hub.id !== "dpo" ? "Riepilogo aggregato in sola lettura" : hub.description}</div>
              </div>
              <ChevronRight className="absolute bottom-4 right-4 h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
