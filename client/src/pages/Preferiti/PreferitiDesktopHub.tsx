import React, { useMemo } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";

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
    description: "Chi ti rappresenta",
    icon: Users,
    accent: "#2563eb",
    accentSoft: "#eff6ff",
  },
  {
    id: "candidati",
    path: "/candidati",
    label: "Candidati",
    description: "Chi voterai alle prossime elezioni",
    icon: Award,
    accent: "#d97706",
    accentSoft: "#fffbeb",
  },
  {
    id: "attivisti",
    path: "/attivisti",
    label: "Attivisti",
    description: "Quale attivista ti rappresenta",
    icon: UserCheck,
    accent: "#db2777",
    accentSoft: "#fdf2f8",
  },
  {
    id: "organizzazioni",
    path: "/organizzazioni",
    label: "Organizzazioni",
    description: "Quale organizzazione sostieni",
    icon: Building2,
    accent: "#7c3aed",
    accentSoft: "#f5f3ff",
  },
  {
    id: "eventi",
    path: "/eventi",
    label: "Eventi",
    description: "Calendario e appuntamenti",
    icon: Calendar,
    accent: "#0ea5e9",
    accentSoft: "#f0f9ff",
    skipOpinioniCheck: true,
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
    description: "Vota per aggiungere una nuova opinione per Demos",
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
    description: "Firma per proporre una nuova legge",
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
    label: "Iniziativa dei Cittadini Europei",
    description: "Firma per nuovi leggi europee",
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
    description: "Chi vuoi come Presidente della Repubblica",
    icon: Crown,
    accent: "#7c3aed",
    accentSoft: "#f5f3ff",
  },
  {
    id: "governo",
    path: "/governo",
    label: "Governo",
    description: "I Ministri che vuoi",
    icon: Building2,
    accent: "#db2777",
    accentSoft: "#fdf2f8",
  },
  {
    id: "grazia",
    path: "/grazia",
    label: "Grazia",
    description: "Chi merita la grazia",
    icon: Scale,
    accent: "#16a34a",
    accentSoft: "#f0fdf4",
  },
  {
    id: "amnistia",
    path: "/amnistia",
    label: "Amnistia",
    description: "Quale reato dovrebbe essere perdonato",
    icon: Archive,
    accent: "#0d9488",
    accentSoft: "#f0fdfa",
  },
  {
    id: "vota-iniziativa",
    path: "/vota-iniziativa-popolare",
    label: "Vota Iniziativa",
    description: "Quale iniziativa popolare ha la priorità",
    icon: Users,
    accent: "#2563eb",
    accentSoft: "#eff6ff",
  },
  {
    id: "vota-referendum",
    path: "/vota-referendum-abrogativo",
    label: "Vota Referendum",
    description: "Quale referendum ha la priorità",
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

function parseAvatarConfig(config: unknown) {
  if (!config) return null;
  try {
    let parsed: any = typeof config === "string" ? JSON.parse(config) : config;
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }
    if (parsed && typeof parsed === "object") return parsed;
    return null;
  } catch {
    return null;
  }
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
        <Icon size={32} strokeWidth={1.75} />
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
  onNavigate,
}: {
  section: DashboardSection;
  onNavigate: NavigateHandler;
}) {
  const SectionIcon = section.icon;
  const items = section.items;
  if (items.length === 0) return null;

  const isPreferiti = section.id === "preferiti";
  const isOpinioni = section.id === "opinioni";
  const isVota = section.id === "vota";
  const gridClass = [
    "demos-dash-section__grid",
    isPreferiti ? "demos-dash-section__grid--preferiti" : "",
    isOpinioni ? "demos-dash-section__grid--opinioni" : "",
    isVota ? "demos-dash-section__grid--vota" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="demos-dash-section">
      <header className="demos-dash-section__head">
        <span className="demos-dash-section__icon" style={{ background: section.accentSoft, color: section.accent }}>
          <SectionIcon size={22} strokeWidth={2} />
        </span>
        <h2 className="demos-dash-section__title">{section.title}</h2>
      </header>
      <div className="demos-dash-section__divider" />
      <div className={gridClass}>
        {items.map((item) => (
          <DashCard
            key={item.id}
            item={item}
            className={
              item.id === "proponi-opinione" || item.id === "eventi" ? "demos-dash-card--span" : undefined
            }
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
}: {
  user: PreferitiDesktopHubProps["user"];
  onNavigate: NavigateHandler;
}) {
  const { logoutMutation } = useAuth();
  const displayName = [user?.nome, user?.cognome].filter(Boolean).join(" ") || user?.email || "Utente";
  const initials = userInitials(user);
  const go = (path: string) => onNavigate(path, { skipOpinioniCheck: true });

  const { data: avatarConfig } = useQuery({
    queryKey: ["preferiti-user-avatar", user?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users/me");
      if (!response?.ok || !response?.data) return null;
      const userData = response.data.user || response.data.data || response.data;
      return parseAvatarConfig(userData?.avatar_config);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="demos-dash-avatar-btn" aria-label="Menu utente">
          <span className={`demos-dash-avatar${avatarConfig ? " demos-dash-avatar--image" : ""}`} aria-hidden>
            {avatarConfig ? (
              <CustomAvatar config={avatarConfig} size={48} className="rounded-full overflow-hidden" />
            ) : (
              initials
            )}
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
        <DropdownMenuItem onClick={() => go("/avvistamenti")}>
          <Binoculars className="mr-2 h-4 w-4" />
          Avvistamenti
        </DropdownMenuItem>
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
  const firstName = user?.nome || "benvenuto";

  const sectionById = useMemo(() => {
    const map = new Map(SECTIONS.map((s) => [s.id, s]));
    return map;
  }, []);

  const preferiti = sectionById.get("preferiti")!;
  const vota = sectionById.get("vota")!;
  const opinioni = sectionById.get("opinioni")!;
  const firma = sectionById.get("firma")!;

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

        <div className="demos-dash-nav__right">
          <button
            type="button"
            className="demos-dash-nav__text-btn"
            onClick={() => onNavigate("/riconoscimento", { skipOpinioniCheck: true })}
            aria-label="Sono un candidato / politico"
            title="Sono un candidato / politico"
          >
            Sono un candidato / politico
          </button>
          <button
            type="button"
            className="demos-dash-nav__icon-btn"
            onClick={() => onNavigate("/segnala-problema", { skipOpinioniCheck: true })}
            aria-label="Segnala problema"
            title="Segnala problema"
          >
            <AlertTriangle size={24} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            className="demos-dash-nav__icon-btn"
            onClick={() => onNavigate("/notifiche", { skipOpinioniCheck: true })}
            aria-label="Notifiche"
            title="Notifiche"
          >
            <Bell size={24} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            className="demos-dash-nav__icon-btn"
            onClick={() => onNavigate("/strumenti", { skipOpinioniCheck: true })}
            aria-label="Strumenti"
            title="Strumenti"
          >
            <Wrench size={24} strokeWidth={1.9} />
          </button>
          <UserMenu user={user} onNavigate={onNavigate} />
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
          <DashSection section={preferiti} onNavigate={onNavigate} />
          <DashSection section={vota} onNavigate={onNavigate} />
        </div>
        <div className="demos-dash-column">
          <DashSection section={opinioni} onNavigate={onNavigate} />
          <DashSection section={firma} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}
