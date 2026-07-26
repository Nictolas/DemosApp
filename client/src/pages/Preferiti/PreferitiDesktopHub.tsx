import React from "react";
import {
  AlertTriangle,
  Archive,
  Award,
  Bell,
  Binoculars,
  Building2,
  Calendar,
  CheckSquare,
  ChevronDown,
  Crown,
  FileText,
  Globe2,
  Lock,
  LogOut,
  Megaphone,
  MessageSquare,
  Scale,
  Shield,
  User,
  UserCheck,
  Users,
  Vote,
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
  skipOpinioniCheck?: boolean;
  visibleFor?: (ruolo?: string) => boolean;
};

function hasAdvancedAccess(ruolo?: string): boolean {
  return (
    ruolo === "P" ||
    ruolo === "C" ||
    ruolo === "CP" ||
    ruolo === "AD" ||
    ruolo === "A" ||
    ruolo === "O" ||
    ruolo === "I"
  );
}

const PREFERITI_SHORTCUTS: Shortcut[] = [
  { id: "politici", path: "/rappresentanti", label: "Politici", description: "I tuoi rappresentanti", icon: Users, accent: "#2563eb" },
  { id: "candidati", path: "/candidati", label: "Candidati", description: "Profili e proposte", icon: Award, accent: "#d97706" },
  { id: "attivisti", path: "/attivisti", label: "Attivisti", description: "Persone sul territorio", icon: UserCheck, accent: "#db2777" },
  { id: "organizzazioni", path: "/organizzazioni", label: "Organizzazioni", description: "Associazioni e gruppi", icon: Building2, accent: "#9333ea" },
  { id: "capo-di-stato", path: "/capo-di-stato", label: "Capo di Stato", description: "Vota il Capo di Stato", icon: Crown, accent: "#7c3aed" },
  { id: "governo", path: "/governo", label: "Governo", description: "Vota il Governo", icon: Building2, accent: "#db2777" },
  { id: "grazia", path: "/grazia", label: "Grazia", description: "Vota sulle grazie", icon: Scale, accent: "#16a34a" },
  { id: "amnistia", path: "/amnistia", label: "Amnistia", description: "Vota sulle amnistie", icon: Archive, accent: "#0d9488" },
  { id: "vota-iniziativa", path: "/vota-iniziativa-popolare", label: "Vota Iniziativa", description: "Iniziative popolari", icon: Users, accent: "#2563eb" },
  { id: "vota-referendum", path: "/vota-referendum-abrogativo", label: "Vota Referendum", description: "Referendum abrogativi", icon: CheckSquare, accent: "#dc2626" },
];

const OPINIONI_SHORTCUTS: Shortcut[] = [
  { id: "opinioni-europee", path: "/opinioni-europee", label: "Opinioni Europee", description: "Temi europei", icon: MessageSquare, accent: "#2563eb", skipOpinioniCheck: true },
  { id: "opinioni-nazionali", path: "/opinioni-nazionali", label: "Opinioni Nazionali", description: "Temi nazionali", icon: MessageSquare, accent: "#16a34a", skipOpinioniCheck: true },
  { id: "opinioni-regionali", path: "/opinioni-regionali", label: "Opinioni Regionali", description: "Temi regionali", icon: MessageSquare, accent: "#9333ea", skipOpinioniCheck: true },
  { id: "opinioni-comunali", path: "/opinioni-comunali", label: "Opinioni Comunali", description: "Temi comunali", icon: MessageSquare, accent: "#ca8a04", skipOpinioniCheck: true },
  { id: "proponi-opinione", path: "/proponi-opinione", label: "Proponi Opinione", description: "Nuova proposta", icon: MessageSquare, accent: "#db2777", skipOpinioniCheck: true },
];

const FIRMA_SHORTCUTS: Shortcut[] = [
  { id: "iniziative-popolari", path: "/iniziative-popolari", label: "Iniziativa Popolare", description: "Proponi una nuova legge", icon: FileText, accent: "#16a34a", skipOpinioniCheck: true },
  { id: "referendum-abrogativi", path: "/referendum-abrogativi", label: "Referendum Abrogativo", description: "Cancella una legge", icon: Vote, accent: "#dc2626", skipOpinioniCheck: true },
  { id: "eci", path: "/eci", label: "ECI", description: "Iniziativa europea", icon: Globe2, accent: "#2563eb", skipOpinioniCheck: true },
];

const APP_SHORTCUTS: Shortcut[] = [
  { id: "eventi", path: "/eventi", label: "Eventi", description: "Calendario e appuntamenti", icon: Calendar, accent: "#0ea5e9", skipOpinioniCheck: true },
  { id: "notifiche", path: "/notifiche", label: "Notifiche", description: "Avvisi e aggiornamenti", icon: Bell, accent: "#f59e0b", skipOpinioniCheck: true },
  { id: "strumenti", path: "/strumenti", label: "Strumenti", description: "Comunicazione e gestione", icon: Megaphone, accent: "#8b5cf6", skipOpinioniCheck: true, visibleFor: hasAdvancedAccess },
  { id: "avvistamenti", path: "/avvistamenti", label: "Avvistamenti", description: "Segnalazioni e osservazioni", icon: Binoculars, accent: "#14b8a6", skipOpinioniCheck: true },
];

function userInitials(user: PreferitiDesktopHubProps["user"]): string {
  const n = (user?.nome || "").trim();
  const c = (user?.cognome || "").trim();
  if (n && c) return `${n[0]}${c[0]}`.toUpperCase();
  if (n) return n.slice(0, 2).toUpperCase();
  if (user?.email) return user.email.slice(0, 2).toUpperCase();
  return "U";
}

function ShortcutButton({ item, onClick }: { item: Shortcut; onClick: () => void }) {
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

function Section({
  title,
  items,
  onNavigate,
  ruolo,
}: {
  title: string;
  items: Shortcut[];
  onNavigate: NavigateHandler;
  ruolo?: string;
}) {
  const visible = items.filter((item) => !item.visibleFor || item.visibleFor(ruolo));
  if (visible.length === 0) return null;

  /* Una colonna per pulsante → una sola riga a tutta larghezza */
  const cols = Math.max(visible.length, 1);

  return (
    <section className="preferiti-desk-section">
      <h2 className="preferiti-desk-section__title">{title}</h2>
      <div
        className="preferiti-desk-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {visible.map((item) => (
          <ShortcutButton
            key={item.id}
            item={item}
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
        <button type="button" className="preferiti-user-menu" aria-label="Menu utente">
          <span className="preferiti-user-menu__avatar" aria-hidden>
            {initials}
          </span>
          <span className="preferiti-user-menu__meta">
            <span className="preferiti-user-menu__name">{displayName}</span>
            <span className="preferiti-user-menu__hint">Account e impostazioni</span>
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
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
 * Hub desktop: tutti i pulsanti in una sola pagina, zero fetch.
 * Nessuna barra laterale — la navigazione è questa pagina.
 */
export function PreferitiDesktopHub({ user, onNavigate, onGoGestisci }: PreferitiDesktopHubProps) {
  const firstName = user?.nome || "benvenuto";

  return (
    <div className="preferiti-desktop-hub preferiti-desktop-hub--light">
      <header className="preferiti-hub__topbar">
        <div className="preferiti-hub__brand">
          {user?.ruolo === "AD" && onGoGestisci ? (
            <button type="button" className="preferiti-hub__logo-btn" onClick={onGoGestisci} aria-label="Vai a Gestisci">
              <img src="/icona.png" alt="Logo Demos" className="preferiti-hub__logo" />
            </button>
          ) : (
            <img src="/icona.png" alt="Logo Demos" className="preferiti-hub__logo" />
          )}
          <span className="preferiti-hub__brand-text">DEMOS</span>
        </div>
        <UserMenu user={user} onNavigate={onNavigate} onGoGestisci={onGoGestisci} />
      </header>

      <div className="preferiti-hub__intro">
        <h1>Ciao, {firstName}</h1>
        <p>Preferiti, Opinioni, Firma e le altre sezioni — tutto in un&apos;unica pagina.</p>
      </div>

      <div className="preferiti-hub__panels">
        <Section title="Preferiti" items={PREFERITI_SHORTCUTS} onNavigate={onNavigate} ruolo={user?.ruolo} />
        <Section title="Opinioni" items={OPINIONI_SHORTCUTS} onNavigate={onNavigate} ruolo={user?.ruolo} />
        <Section title="Firma" items={FIRMA_SHORTCUTS} onNavigate={onNavigate} ruolo={user?.ruolo} />
        <Section title="Altro" items={APP_SHORTCUTS} onNavigate={onNavigate} ruolo={user?.ruolo} />
      </div>
    </div>
  );
}
