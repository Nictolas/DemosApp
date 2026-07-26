import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Building2,
  ChevronRight,
  Crown,
  MessageSquare,
  Scale,
  User,
  UserCheck,
  Users,
  Vote,
  Archive,
  CheckSquare,
} from "lucide-react";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";
import { apiRequest } from "@/lib/queryClient";
import { useRappresentantiData } from "@/pages/Rappresentanti/hooks/useRappresentantiData";
import { useCandidatiData } from "@/pages/Candidati/hooks/useCandidatiData";
import { categorie as rappresentantiCategorie } from "@/pages/Rappresentanti/constants/categorie";
import { categorie as candidatiCategorie } from "@/pages/Candidati/constants/categorie";

type NavigateHandler = (path: string, options?: { skipOpinioniCheck?: boolean }) => void;

interface PreferitiDesktopHubProps {
  user: { id?: string; nome?: string; ruolo?: string } | null;
  onNavigate: NavigateHandler;
  onGoGestisci?: () => void;
}

function parseAvatarConfig(raw: unknown) {
  if (!raw) return null;
  try {
    let config = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (typeof config === "string") config = JSON.parse(config);
    return config;
  } catch {
    return null;
  }
}

function getSelectedPerson(
  collection: Record<string, any> | undefined,
  categoriaId: string,
): { id?: string; nome?: string; cognome?: string; avatar_config?: unknown } | null {
  if (!collection) return null;
  const entry = collection[categoriaId];
  if (!entry) return null;
  if (Array.isArray(entry)) return entry[0] || null;
  if (typeof entry === "object") return entry;
  return null;
}

function PersonChip({
  nome,
  cognome,
  avatar_config,
  emptyLabel = "Nessuno scelto",
}: {
  nome?: string;
  cognome?: string;
  avatar_config?: unknown;
  emptyLabel?: string;
}) {
  const config = parseAvatarConfig(avatar_config);
  const hasName = Boolean(nome && cognome);

  return (
    <div className="preferiti-hub__person">
      <div className="preferiti-hub__avatar">
        {config ? (
          <CustomAvatar config={config} size={36} className="w-full h-full" />
        ) : (
          <User className="h-4 w-4 text-slate-400" />
        )}
      </div>
      <span className={hasName ? "preferiti-hub__person-name" : "preferiti-hub__person-empty"}>
        {hasName ? `${nome} ${cognome}` : emptyLabel}
      </span>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  accent,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  accent: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="preferiti-hub__section-head">
      <div className="preferiti-hub__section-title">
        <span className="preferiti-hub__section-icon" style={{ background: accent }}>
          <Icon className="h-4 w-4 text-white" />
        </span>
        <h2>{title}</h2>
      </div>
      <button type="button" className="preferiti-hub__link" onClick={onAction}>
        {actionLabel}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PreferitiDesktopHub({ user, onNavigate, onGoGestisci }: PreferitiDesktopHubProps) {
  const { data: rappresentantiData, isLoading: loadingRappresentanti } = useRappresentantiData(user);
  const { data: candidatiData, isLoading: loadingCandidati } = useCandidatiData(user);

  const { data: attivistiPreview = [], isLoading: loadingAttivisti } = useQuery({
    queryKey: ["preferiti-hub-attivisti"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/attivisti");
      if (!response?.ok) return [];
      const body = response.data as { success?: boolean; data?: unknown[] };
      const list = Array.isArray(body?.data) ? body.data : [];
      return list.slice(0, 5);
    },
    enabled: !!user,
  });

  const { data: opinioniStatus } = useQuery({
    queryKey: ["preferiti-hub-opinioni"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/opinioni/check-missing-all");
      if (!response?.ok || !response?.data) return null;
      const apiData = response.data as {
        success?: boolean;
        data?: {
          allComplete: boolean;
          totaleOpinioni: number;
          opinioniRisposte: number;
          opinioniMancanti: number;
          percentualeCompletamento: number;
        };
      };
      if (!apiData.success || !apiData.data) return null;
      return apiData.data;
    },
    enabled: !!user,
  });

  const rappresentantiRows = useMemo(
    () =>
      rappresentantiCategorie.map((cat) => ({
        ...cat,
        person: getSelectedPerson(rappresentantiData?.rappresentanti, cat.id),
      })),
    [rappresentantiData],
  );

  const candidatiRows = useMemo(
    () =>
      candidatiCategorie.map((cat) => ({
        ...cat,
        person: getSelectedPerson((candidatiData as any)?.candidati, cat.id),
      })),
    [candidatiData],
  );

  const opinioniPct = Math.round(opinioniStatus?.percentualeCompletamento ?? 0);
  const greeting = user?.nome ? `Ciao, ${user.nome}` : "I tuoi Preferiti";

  const votaLinks = [
    { path: "/capo-di-stato", label: "Capo di Stato", icon: Crown, color: "#7c3aed" },
    { path: "/governo", label: "Governo", icon: Building2, color: "#db2777" },
    { path: "/grazia", label: "Grazia", icon: Scale, color: "#16a34a" },
    { path: "/amnistia", label: "Amnistia", icon: Archive, color: "#0d9488" },
    { path: "/vota-iniziativa-popolare", label: "Iniziativa popolare", icon: Users, color: "#2563eb" },
    { path: "/vota-referendum-abrogativo", label: "Referendum", icon: CheckSquare, color: "#dc2626" },
  ];

  const opinioniLinks = [
    { path: "/opinioni-europee", label: "Europee", color: "#2563eb" },
    { path: "/opinioni-nazionali", label: "Nazionali", color: "#16a34a" },
    { path: "/opinioni-regionali", label: "Regionali", color: "#9333ea" },
    { path: "/opinioni-comunali", label: "Comunali", color: "#ca8a04" },
  ];

  return (
    <div className="preferiti-desktop-hub">
      <header className="preferiti-hub__hero">
        <div className="preferiti-hub__hero-text">
          {user?.ruolo === "AD" && onGoGestisci ? (
            <button type="button" className="preferiti-hub__logo-btn" onClick={onGoGestisci} aria-label="Vai a Gestisci">
              <img src="/icona.png" alt="Logo Demos" className="preferiti-hub__logo" />
            </button>
          ) : (
            <img src="/icona.png" alt="Logo Demos" className="preferiti-hub__logo" />
          )}
          <div>
            <p className="preferiti-hub__eyebrow">DEMOS</p>
            <h1>{greeting}</h1>
            <p className="preferiti-hub__subtitle">
              Panoramica di politici, candidati, attivisti, opinioni e votazioni — tutto in un unico spazio.
            </p>
          </div>
        </div>
      </header>

      <div className="preferiti-hub__grid">
        <section className="preferiti-hub__panel">
          <SectionHeader
            icon={Users}
            title="Politici"
            accent="#2563eb"
            actionLabel="Apri"
            onAction={() => onNavigate("/rappresentanti")}
          />
          <div className="preferiti-hub__list">
            {loadingRappresentanti ? (
              <p className="preferiti-hub__muted">Caricamento…</p>
            ) : (
              rappresentantiRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="preferiti-hub__row"
                  onClick={() => onNavigate(`/scegli-rappresentante/${row.id}`)}
                >
                  <div>
                    <div className="preferiti-hub__row-label">{row.nome}</div>
                    <PersonChip
                      nome={row.person?.nome}
                      cognome={row.person?.cognome}
                      avatar_config={row.person?.avatar_config}
                    />
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                </button>
              ))
            )}
          </div>
        </section>

        <section className="preferiti-hub__panel">
          <SectionHeader
            icon={Award}
            title="Candidati"
            accent="#d97706"
            actionLabel="Apri"
            onAction={() => onNavigate("/candidati")}
          />
          <div className="preferiti-hub__list">
            {loadingCandidati ? (
              <p className="preferiti-hub__muted">Caricamento…</p>
            ) : (
              candidatiRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="preferiti-hub__row"
                  onClick={() => onNavigate(`/candidati/${row.id}`)}
                >
                  <div>
                    <div className="preferiti-hub__row-label">{row.nome}</div>
                    <PersonChip
                      nome={row.person?.nome}
                      cognome={row.person?.cognome}
                      avatar_config={row.person?.avatar_config}
                    />
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                </button>
              ))
            )}
          </div>
        </section>

        <section className="preferiti-hub__panel">
          <SectionHeader
            icon={UserCheck}
            title="Attivisti"
            accent="#db2777"
            actionLabel="Vedi tutti"
            onAction={() => onNavigate("/attivisti")}
          />
          <div className="preferiti-hub__list">
            {loadingAttivisti ? (
              <p className="preferiti-hub__muted">Caricamento…</p>
            ) : attivistiPreview.length === 0 ? (
              <p className="preferiti-hub__muted">Nessun attivista in evidenza.</p>
            ) : (
              attivistiPreview.map((a: any) => (
                <div key={a.id} className="preferiti-hub__row preferiti-hub__row--static">
                  <PersonChip nome={a.nome} cognome={a.cognome} avatar_config={a.avatar_config} />
                  <span className="preferiti-hub__badge">{a.supporters_count ?? 0} sostenitori</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="preferiti-hub__panel">
          <SectionHeader
            icon={Building2}
            title="Organizzazioni"
            accent="#9333ea"
            actionLabel="Apri"
            onAction={() => onNavigate("/organizzazioni")}
          />
          <p className="preferiti-hub__muted preferiti-hub__panel-copy">
            Scopri associazioni e realtà locali, e sostieni quelle più vicine alle tue cause.
          </p>
          <button type="button" className="preferiti-hub__cta" onClick={() => onNavigate("/organizzazioni")}>
            Esplora organizzazioni
            <ChevronRight className="h-4 w-4" />
          </button>
        </section>

        <section className="preferiti-hub__panel preferiti-hub__panel--wide">
          <SectionHeader
            icon={MessageSquare}
            title="Opinioni"
            accent="#dc2626"
            actionLabel="Gestisci"
            onAction={() => onNavigate("/opinioni", { skipOpinioniCheck: true })}
          />
          <div className="preferiti-hub__opinioni">
            <div className="preferiti-hub__progress-block">
              <div className="preferiti-hub__progress-meta">
                <span>Completamento</span>
                <strong>{opinioniPct}%</strong>
              </div>
              <div className="preferiti-hub__progress-track">
                <div className="preferiti-hub__progress-fill" style={{ width: `${Math.min(100, opinioniPct)}%` }} />
              </div>
              <p className="preferiti-hub__muted">
                {opinioniStatus
                  ? `${opinioniStatus.opinioniRisposte}/${opinioniStatus.totaleOpinioni} risposte · ${opinioniStatus.opinioniMancanti} mancanti`
                  : "Caricamento stato opinioni…"}
              </p>
            </div>
            <div className="preferiti-hub__chips">
              {opinioniLinks.map((link) => (
                <button
                  key={link.path}
                  type="button"
                  className="preferiti-hub__chip"
                  style={{ borderColor: link.color, color: link.color }}
                  onClick={() => onNavigate(link.path, { skipOpinioniCheck: true })}
                >
                  {link.label}
                </button>
              ))}
              <button
                type="button"
                className="preferiti-hub__chip preferiti-hub__chip--solid"
                onClick={() => onNavigate("/proponi-opinione", { skipOpinioniCheck: true })}
              >
                Proponi nuova
              </button>
            </div>
          </div>
        </section>

        <section className="preferiti-hub__panel preferiti-hub__panel--wide">
          <SectionHeader
            icon={Vote}
            title="Vota"
            accent="#16a34a"
            actionLabel="Apri"
            onAction={() => onNavigate("/vota")}
          />
          <div className="preferiti-hub__chips preferiti-hub__chips--wrap">
            {votaLinks.map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.path}
                  type="button"
                  className="preferiti-hub__vote-chip"
                  onClick={() => onNavigate(link.path)}
                >
                  <Icon className="h-4 w-4" style={{ color: link.color }} />
                  {link.label}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
