import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Award,
  Bell,
  Binoculars,
  Building2,
  Calendar,
  CheckSquare,
  Crown,
  FileText,
  Globe2,
  Lock,
  LogOut,
  MessageSquare,
  PenLine,
  Scale,
  Search,
  Shield,
  Star,
  User,
  UserCheck,
  Users,
  Vote,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

type NavigateHandler = (path: string, options?: { skipOpinioniCheck?: boolean }) => void;

interface PreferitiDesktopHubProps {
  user: { id?: string; nome?: string; cognome?: string; email?: string; ruolo?: string } | null;
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
  accentSoft: string;
  skipOpinioniCheck?: boolean;
};

const PREFERITI_SHORTCUTS: Shortcut[] = [
  {
    id: "politici",
    path: "/rappresentanti",
    label: "Politici",
    description: "I tuoi rappresentanti eletti",
    icon: Users,
    accent: "#2563eb",
    accentSoft: "#eff6ff",
  },
  {
    id: "candidati",
    path: "/candidati",
    label: "Candidati",
    description: "Profili e proposte elettorali",
    icon: Award,
    accent: "#d97706",
    accentSoft: "#fffbeb",
  },
  {
    id: "attivisti",
    path: "/attivisti",
    label: "Attivisti",
    description: "Persone attive sul territorio",
    icon: UserCheck,
    accent: "#db2777",
    accentSoft: "#fdf2f8",
  },
  {
    id: "organizzazioni",
    path: "/organizzazioni",
    label: "Organizzazioni",
    description: "Associazioni e gruppi civici",
    icon: Building2,
    accent: "#7c3aed",
    accentSoft: "#f5f3ff",
  },
];

const OPINIONI_SHORTCUTS: Shortcut[] = [
  {
    id: "opinioni-europee",
    path: "/opinioni-europee",
    label: "Europee",
    description: "Temi e proposte europee",
    icon: Globe2,
    accent: "#2563eb",
    accentSoft: "#eff6ff",
    skipOpinioniCheck: true,
  },
  {
    id: "opinioni-nazionali",
    path: "/opinioni-nazionali",
    label: "Nazionali",
    description: "Questioni nazionali",
    icon: MessageSquare,
    accent: "#16a34a",
    accentSoft: "#f0fdf4",
    skipOpinioniCheck: true,
  },
  {
    id: "opinioni-regionali",
    path: "/opinioni-regionali",
    label: "Regionali",
    description: "Temi della tua regione",
    icon: MessageSquare,
    accent: "#7c3aed",
    accentSoft: "#f5f3ff",
    skipOpinioniCheck: true,
  },
  {
    id: "opinioni-comunali",
    path: "/opinioni-comunali",
    label: "Comunali",
    description: "Questioni del tuo comune",
    icon: MessageSquare,
    accent: "#ca8a04",
    accentSoft: "#fefce8",
    skipOpinioniCheck: true,
  },
  {
    id: "proponi-opinione",
    path: "/proponi-opinione",
    label: "Proponi Opinione",
    description: "Avvia una nuova proposta",
    icon: PenLine,
    accent: "#db2777",
    accentSoft: "#fdf2f8",
    skipOpinioniCheck: true,
  },
];

const FIRMA_SHORTCUTS: Shortcut[] = [
  {
    id: "iniziative-popolari",
    path: "/iniziative-popolari",
    label: "Iniziativa Popolare",
    description: "Proponi una nuova legge",
    icon: FileText,
    accent: "#16a34a",
    accentSoft: "#f0fdf4",
    skipOpinioniCheck: true,
  },
  {
    id: "referendum-abrogativi",
    path: "/referendum-abrogativi",
    label: "Referendum Abrogativo",
    description: "Richiedi l’abrogazione di una legge",
    icon: Vote,
    accent: "#dc2626",
    accentSoft: "#fef2f2",
    skipOpinioniCheck: true,
  },
  {
    id: "eci",
    path: "/eci",
    label: "ECI",
    description: "European Citizens’ Initiative",
    icon: Globe2,
    accent: "#2563eb",
    accentSoft: "#eff6ff",
    skipOpinioniCheck: true,
  },
];

const VOTA_SHORTCUTS: Shortcut[] = [
  {
    id: "capo-di-stato",
    path: "/capo-di-stato",
    label: "Capo di Stato",
    description: "Vota il Capo di Stato",
    icon: Crown,
    accent: "#7c3aed",
    accentSoft: "#f5f3ff",
  },
  {
    id: "governo",
    path: "/governo",
    label: "Governo",
    description: "Vota il Governo",
    icon: Building2,
    accent: "#db2777",
    accentSoft: "#fdf2f8",
  },
  {
    id: "grazia",
    path: "/grazia",
    label: "Grazia",
    description: "Esprimi il tuo voto sulle grazie",
    icon: Scale,
    accent: "#16a34a",
    accentSoft: "#f0fdf4",
  },
  {
    id: "amnistia",
    path: "/amnistia",
    label: "Amnistia",
    description: "Esprimi il tuo voto sulle amnistie",
    icon: Archive,
    accent: "#0d9488",
    accentSoft: "#f0fdfa",
  },
  {
    id: "vota-iniziativa",
    path: "/vota-iniziativa-popolare",
    label: "Vota Iniziativa",
    description: "Vota sulle iniziative popolari",
    icon: Users,
    accent: "#2563eb",
    accentSoft: "#eff6ff",
  },
  {
    id: "vota-referendum",
    path: "/vota-referendum-abrogativo",
    label: "Vota Referendum",
    description: "Vota sui referendum abrogativi",
    icon: CheckSquare,
    accent: "#dc2626",
    accentSoft: "#fef2f2",
  },
];

type DashboardSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  accent: string;
  accentSoft: string;
  items: Shortcut[];
};

const SECTIONS: DashboardSection[] = [
  {
    id: "preferiti",
    title: "Preferiti",
    icon: Star,
    accent: "#2563eb",
    accentSoft: "#eff6ff",
    items: PREFERITI_SHORTCUTS,
  },
  {
    id: "opinioni",
    title: "Opinioni",
    icon: MessageSquare,
    accent: "#7c3aed",
    accentSoft: "#f5f3ff",
    items: OPINIONI_SHORTCUTS,
  },
  {
    id: "firma",
    title: "Firma",
    icon: PenLine,
    accent: "#16a34a",
    accentSoft: "#f0fdf4",
    items: FIRMA_SHORTCUTS,
  },
  {
    id: "vota",
    title: "Vota",
    icon: Vote,
    accent: "#db2777",
    accentSoft: "#fdf2f8",
    items: VOTA_SHORTCUTS,
  },
];

function userInitials(user: PreferitiDesktopHubProps["user"]): string {
  const n = (user?.nome || "").trim();
  const c = (user?.cognome || "").trim();
  if (n && c) return `${n[0]}${c[0]}`.toUpperCase();
  if (n) return n.slice(0, 2).toUpperCase();
  if (user?.email) return user.email.slice(0, 2).toUpperCase();
  return "U";
}

function DashCard({
  item,
  onClick,
  className,
}: {
  item: Shortcut;
  onClick: () => void;
  className?: string;
}) {
  const Icon = item.icon;
  return (
    <button type="button" className={`demos-dash-card${className ? ` ${className}` : ""}`} onClick={onClick}>
      <span className="demos-dash-card__icon" style={{ background: item.accentSoft, color: item.accent }}>
        <Icon size={28} strokeWidth={1.75} />
      </span>
      <span className="demos-dash-card__body">
        <span className="demos-dash-card__title">{item.label}</span>
        <span className="demos-dash-card__desc">{item.description}</span>
      </span>
    </button>
  );
}

function DashSection({
  section,
  query,
  onNavigate,
}: {
  section: DashboardSection;
  query: string;
  onNavigate: NavigateHandler;
}) {
  const SectionIcon = section.icon;
  const q = query.trim().toLowerCase();
  const items = section.items.filter((item) => {
    if (!q) return true;
    return item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
  });
  if (items.length === 0) return null;

  const isPreferiti = section.id === "preferiti";
  const isOpinioni = section.id === "opinioni";
  const gridClass = [
    "demos-dash-section__grid",
    isPreferiti ? "demos-dash-section__grid--preferiti" : "",
    isOpinioni ? "demos-dash-section__grid--opinioni" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="demos-dash-section">
      <header className="demos-dash-section__head">
        <span className="demos-dash-section__icon" style={{ background: section.accentSoft, color: section.accent }}>
          <SectionIcon size={18} strokeWidth={2} />
        </span>
        <h2 className="demos-dash-section__title">{section.title}</h2>
      </header>
      <div className="demos-dash-section__divider" />
      <div className={gridClass}>
        {items.map((item) => (
          <DashCard
            key={item.id}
            item={item}
            className={item.id === "proponi-opinione" ? "demos-dash-card--span" : undefined}
            onClick={() => onNavigate(item.path, { skipOpinioniCheck: item.skipOpinioniCheck })}
          />
        ))}
      </div>
    </section>
  );
}

function UserMenu({
  user,
  onNavigate,
  onGoGestisci,
}: {
  user: PreferitiDesktopHubProps["user"];
  onNavigate: NavigateHandler;
  onGoGestisci?: () => void;
}) {
  const { logoutMutation } = useAuth();
  const displayName = [user?.nome, user?.cognome].filter(Boolean).join(" ") || user?.email || "Utente";
  const initials = userInitials(user);
  const go = (path: string) => onNavigate(path, { skipOpinioniCheck: true });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="demos-dash-avatar-btn" aria-label="Menu utente">
          <span className="demos-dash-avatar" aria-hidden>
            {initials}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="preferiti-user-menu-content w-64 bg-white">
        <DropdownMenuLabel className="font-normal bg-white">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-slate-900">{displayName}</span>
            {user?.email ? <span className="text-xs text-slate-500 truncate">{user.email}</span> : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => go("/profilo")}>
          <User className="mr-2 h-4 w-4" />
          Profilo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/impostazioni/informazioni-legali")}>
          <Scale className="mr-2 h-4 w-4" />
          Informazioni Legali
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/impostazioni")}>
          <Lock className="mr-2 h-4 w-4" />
          Password
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/riconoscimento")}>
          <Award className="mr-2 h-4 w-4" />
          Riconoscimento
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/segnala-problema")}>
          <AlertTriangle className="mr-2 h-4 w-4" />
          Segnala Problema
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/avvistamenti")}>
          <Binoculars className="mr-2 h-4 w-4" />
          Avvistamenti
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/eventi")}>
          <Calendar className="mr-2 h-4 w-4" />
          Eventi
        </DropdownMenuItem>
        {user?.ruolo === "AD" && onGoGestisci ? (
          <DropdownMenuItem onClick={onGoGestisci}>
            <Shield className="mr-2 h-4 w-4" />
            Gestisci
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600 focus:text-red-700"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Homepage desktop premium — stile Linear / Notion / Stripe / Vercel.
 */
export function PreferitiDesktopHub({ user, onNavigate, onGoGestisci }: PreferitiDesktopHubProps) {
  const [query, setQuery] = useState("");
  const firstName = user?.nome || "benvenuto";

  const sectionById = useMemo(() => {
    const map = new Map(SECTIONS.map((s) => [s.id, s]));
    return map;
  }, []);

  const preferiti = sectionById.get("preferiti")!;
  const vota = sectionById.get("vota")!;
  const opinioni = sectionById.get("opinioni")!;
  const firma = sectionById.get("firma")!;

  const q = query.trim().toLowerCase();
  const sectionMatches = (section: DashboardSection) =>
    !q ||
    section.items.some(
      (item) => item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    );

  const hasAny =
    sectionMatches(preferiti) || sectionMatches(vota) || sectionMatches(opinioni) || sectionMatches(firma);

  return (
    <div className="demos-dash">
      <header className="demos-dash-nav">
        <div className="demos-dash-nav__left">
          {user?.ruolo === "AD" && onGoGestisci ? (
            <button type="button" className="demos-dash-brand" onClick={onGoGestisci} aria-label="Vai a Gestisci">
              <img src="/icona.png" alt="" className="demos-dash-brand__logo" />
              <span className="demos-dash-brand__text">DEMOS</span>
            </button>
          ) : (
            <div className="demos-dash-brand" aria-label="DEMOS">
              <img src="/icona.png" alt="" className="demos-dash-brand__logo" />
              <span className="demos-dash-brand__text">DEMOS</span>
            </div>
          )}
        </div>

        <label className="demos-dash-search">
          <Search className="demos-dash-search__icon" size={16} strokeWidth={2} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca sezioni e azioni…"
            aria-label="Cerca"
          />
        </label>

        <div className="demos-dash-nav__right">
          <button
            type="button"
            className="demos-dash-nav__icon-btn"
            onClick={() => onNavigate("/notifiche", { skipOpinioniCheck: true })}
            aria-label="Notifiche"
            title="Notifiche"
          >
            <Bell size={18} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            className="demos-dash-nav__icon-btn"
            onClick={() => onNavigate("/strumenti", { skipOpinioniCheck: true })}
            aria-label="Strumenti"
            title="Strumenti"
          >
            <Wrench size={18} strokeWidth={1.9} />
          </button>
          <UserMenu user={user} onNavigate={onNavigate} onGoGestisci={onGoGestisci} />
        </div>
      </header>

      <div className="demos-dash-welcome">
        <div className="demos-dash-welcome__text">
          <h1>
            <span aria-hidden>👋</span> Ciao, {firstName}
          </h1>
          <p>Partecipa alla vita democratica della tua comunità.</p>
        </div>
      </div>

      <div className="demos-dash-columns">
        <div className="demos-dash-column">
          {sectionMatches(preferiti) ? (
            <DashSection section={preferiti} query={query} onNavigate={onNavigate} />
          ) : null}
          {sectionMatches(vota) ? <DashSection section={vota} query={query} onNavigate={onNavigate} /> : null}
        </div>
        <div className="demos-dash-column">
          {sectionMatches(opinioni) ? (
            <DashSection section={opinioni} query={query} onNavigate={onNavigate} />
          ) : null}
          {sectionMatches(firma) ? <DashSection section={firma} query={query} onNavigate={onNavigate} /> : null}
        </div>
      </div>
      {!hasAny ? <p className="demos-dash-empty">Nessun risultato per “{query.trim()}”.</p> : null}
    </div>
  );
}
