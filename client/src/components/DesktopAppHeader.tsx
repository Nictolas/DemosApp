import React from "react";
import {
  AlertTriangle,
  Bell,
  Binoculars,
  LogOut,
  Scale,
  User,
  Wrench,
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
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";

type AuthUser = {
  id?: string;
  nome?: string;
  cognome?: string;
  email?: string;
  ruolo?: string;
} | null;

function userInitials(user: AuthUser): string {
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

function UserMenu({ user }: { user: AuthUser }) {
  const { logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const displayName = [user?.nome, user?.cognome].filter(Boolean).join(" ") || user?.email || "Utente";
  const initials = userInitials(user);

  const { data: avatarConfig } = useQuery({
    queryKey: ["desktop-user-avatar", user?.id],
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
        <DropdownMenuItem onClick={() => setLocation("/profilo")}>
          <User className="mr-2 h-4 w-4" />
          Profilo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocation("/impostazioni/informazioni-legali")}>
          <Scale className="mr-2 h-4 w-4" />
          Informazioni Legali
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocation("/avvistamenti")}>
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
 * Header desktop condiviso — stesso di Preferiti, su tutte le pagine PC.
 */
export function DesktopAppHeader() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const isPreferiti = location === "/preferiti" || location.startsWith("/preferiti/");
  const isAdmin = user?.ruolo === "AD";

  const handleBrandClick = () => {
    if (isPreferiti) {
      if (isAdmin) setLocation("/gestisci");
      return;
    }
    setLocation("/preferiti");
  };

  const brandLabel = isPreferiti && isAdmin ? "Vai a Gestisci" : isPreferiti ? "DEMOS" : "Torna a Preferiti";

  return (
    <div className="demos-desktop-topbar">
      <header className="demos-dash-nav">
        <div className="demos-dash-nav__left">
          {isPreferiti && !isAdmin ? (
            <div className="demos-dash-brand" aria-label="DEMOS">
              <img src="/icona.png" alt="" className="demos-dash-brand__logo" />
              <span className="demos-dash-brand__text">DEMOS</span>
            </div>
          ) : (
            <button
              type="button"
              className="demos-dash-brand"
              onClick={handleBrandClick}
              aria-label={brandLabel}
            >
              <img src="/icona.png" alt="" className="demos-dash-brand__logo" />
              <span className="demos-dash-brand__text">DEMOS</span>
            </button>
          )}
        </div>

        <div className="demos-dash-nav__right">
          <button
            type="button"
            className="demos-dash-nav__text-btn"
            onClick={() => setLocation("/riconoscimento")}
            aria-label="Sono un candidato / politico"
            title="Sono un candidato / politico"
          >
            Sono un candidato / politico
          </button>
          <button
            type="button"
            className="demos-dash-nav__icon-btn"
            onClick={() => setLocation("/segnala-problema")}
            aria-label="Segnala problema"
            title="Segnala problema"
          >
            <AlertTriangle size={24} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            className="demos-dash-nav__icon-btn"
            onClick={() => setLocation("/notifiche")}
            aria-label="Notifiche"
            title="Notifiche"
          >
            <Bell size={24} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            className="demos-dash-nav__icon-btn"
            onClick={() => setLocation("/strumenti")}
            aria-label="Strumenti"
            title="Strumenti"
          >
            <Wrench size={24} strokeWidth={1.9} />
          </button>
          <UserMenu user={user} />
        </div>
      </header>
    </div>
  );
}
