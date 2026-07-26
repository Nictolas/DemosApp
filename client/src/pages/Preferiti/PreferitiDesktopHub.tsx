import React from "react";
import {
  Award,
  Bell,
  Binoculars,
  Building2,
  Calendar,
  Megaphone,
  MessageSquare,
  PenLine,
  Settings,
  UserCheck,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { getVisibleNavItems } from "@/lib/nav-items";

type NavigateHandler = (path: string, options?: { skipOpinioniCheck?: boolean }) => void;

interface PreferitiDesktopHubProps {
  user: { id?: string; nome?: string; ruolo?: string } | null;
  onNavigate: NavigateHandler;
  onGoGestisci?: () => void;
}

type Shortcut = {
  id: string;
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  skipOpinioniCheck?: boolean;
};

const PREFERITI_SHORTCUTS: Shortcut[] = [
  {
    id: "politici",
    path: "/rappresentanti",
    label: "Politici",
    description: "I tuoi rappresentanti",
    icon: Users,
    accent: "#2563eb",
  },
  {
    id: "candidati",
    path: "/candidati",
    label: "Candidati",
    description: "Profili e proposte",
    icon: Award,
    accent: "#d97706",
  },
  {
    id: "attivisti",
    path: "/attivisti",
    label: "Attivisti",
    description: "Persone sul territorio",
    icon: UserCheck,
    accent: "#db2777",
  },
  {
    id: "organizzazioni",
    path: "/organizzazioni",
    label: "Organizzazioni",
    description: "Associazioni e gruppi",
    icon: Building2,
    accent: "#9333ea",
  },
  {
    id: "opinioni",
    path: "/opinioni",
    label: "Opinioni",
    description: "Le tue posizioni",
    icon: MessageSquare,
    accent: "#dc2626",
    skipOpinioniCheck: true,
  },
  {
    id: "vota",
    path: "/vota",
    label: "Vota",
    description: "Partecipa alle votazioni",
    icon: Vote,
    accent: "#16a34a",
  },
];

const NAV_ACCENTS: Record<string, string> = {
  "/eventi": "#0ea5e9",
  "/firma": "#6366f1",
  "/notifiche": "#f59e0b",
  "/strumenti": "#8b5cf6",
  "/avvistamenti": "#14b8a6",
  "/impostazioni": "#64748b",
};

const NAV_DESCRIPTIONS: Record<string, string> = {
  "/eventi": "Calendario e appuntamenti",
  "/firma": "Iniziative e raccolte firme",
  "/notifiche": "Avvisi e aggiornamenti",
  "/strumenti": "Comunicazione e gestione",
  "/avvistamenti": "Segnalazioni e osservazioni",
  "/impostazioni": "Account e preferenze",
};

const NAV_FALLBACK_ICONS: Record<string, LucideIcon> = {
  "/eventi": Calendar,
  "/firma": PenLine,
  "/notifiche": Bell,
  "/strumenti": Megaphone,
  "/avvistamenti": Binoculars,
  "/impostazioni": Settings,
};

function ShortcutButton({
  item,
  onClick,
}: {
  item: Shortcut;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button type="button" className="preferiti-desk-btn" onClick={onClick}>
      <span className="preferiti-desk-btn__icon" style={{ background: item.accent }}>
        <Icon className="h-5 w-5 text-white" />
      </span>
      <span className="preferiti-desk-btn__text">
        <span className="preferiti-desk-btn__label">{item.label}</span>
        <span className="preferiti-desk-btn__desc">{item.description}</span>
      </span>
    </button>
  );
}

/** Preferiti desktop: solo scorciatoie, zero fetch API. */
export function PreferitiDesktopHub({ user, onNavigate, onGoGestisci }: PreferitiDesktopHubProps) {
  const greeting = user?.nome ? `Ciao, ${user.nome}` : "Area personale";

  const appShortcuts: Shortcut[] = getVisibleNavItems(user?.ruolo)
    .filter((item) => item.path !== "/preferiti")
    .map((item) => ({
      id: item.path,
      path: item.path,
      label: item.label,
      description: NAV_DESCRIPTIONS[item.path] || "Vai alla sezione",
      icon: item.icon || NAV_FALLBACK_ICONS[item.path] || Settings,
      accent: NAV_ACCENTS[item.path] || "#475569",
      skipOpinioniCheck: true,
    }));

  return (
    <div className="preferiti-desktop-hub preferiti-desktop-hub--light">
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
              Tutte le scorciatoie in un unico posto — senza caricare dati in anticipo.
            </p>
          </div>
        </div>
      </header>

      <section className="preferiti-desk-section">
        <h2 className="preferiti-desk-section__title">Preferiti</h2>
        <div className="preferiti-desk-grid">
          {PREFERITI_SHORTCUTS.map((item) => (
            <ShortcutButton
              key={item.id}
              item={item}
              onClick={() => onNavigate(item.path, { skipOpinioniCheck: item.skipOpinioniCheck })}
            />
          ))}
        </div>
      </section>

      <section className="preferiti-desk-section">
        <h2 className="preferiti-desk-section__title">Navigazione</h2>
        <div className="preferiti-desk-grid">
          {appShortcuts.map((item) => (
            <ShortcutButton
              key={item.id}
              item={item}
              onClick={() => onNavigate(item.path, { skipOpinioniCheck: true })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
