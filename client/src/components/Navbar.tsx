import { Home, Settings, Bell, Megaphone, Heart, Calendar, Globe } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { useNotificationBadge } from "@/hooks/useNotificationBadge";

export default function Navbar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { unreadCount } = useNotificationBadge();

  // Funzione per determinare se un link è attivo
  const isActive = (path: string) => {
    if (path === "/menu") {
      return location === "/menu";
    }
    return location.startsWith(path);
  };

  // Funzione per ottenere le classi CSS di un link
  const getLinkClasses = (path: string) => {
    const baseClasses = "flex flex-col items-center justify-center transition-all duration-200";
    const activeClasses = "text-blue-600 scale-110 font-semibold";
    const inactiveClasses = "text-gray-600 hover:text-blue-500 hover:scale-105";
    
    return `${baseClasses} ${isActive(path) ? activeClasses : inactiveClasses}`;
  };

  // Determina se l'utente ha accesso agli strumenti avanzati
  const userRole = user?.role || user?.ruolo;
  const hasAdvancedAccess = userRole === "P" || userRole === "C" || userRole === "CP" || userRole === "AD" || userRole === "A" || userRole === "O";
  
  // Determina se l'utente ha accesso limitato (solo Evento e Sostenitori)
  const hasLimitedAccess = userRole === "A" || userRole === "O";

  return (
    <nav className="bg-white border-t border-gray-200 flex justify-center items-center h-24 pt-3 pb-4 select-none px-4" style={{ boxShadow: '0 -1px 8px 0 rgba(0,0,0,0.03)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
      <div className="flex items-center justify-center gap-10 max-w-md">
        <Link href="/menu" className={getLinkClasses("/menu")} style={{marginTop: 0}}>
          <Home className={`h-7 w-7 mb-1 ${isActive("/menu") ? "drop-shadow-lg text-blue-600" : ""}`} />
          <span className={`text-xs hidden md:block ${isActive("/menu") ? "text-blue-600 font-semibold" : ""}`}>Menu</span>
        </Link>
        <Link href="/eventi" className={getLinkClasses("/eventi")} style={{marginTop: 0}}>
          <Calendar className={`h-7 w-7 mb-1 ${isActive("/eventi") ? "drop-shadow-lg text-blue-600" : ""}`} />
          <span className={`text-xs hidden md:block ${isActive("/eventi") ? "text-blue-600 font-semibold" : ""}`}>Eventi</span>
        </Link>
        <Link href="/preferiti" className={getLinkClasses("/preferiti")} style={{marginTop: 0}}>
          <Heart className={`h-7 w-7 mb-1 ${isActive("/preferiti") ? "drop-shadow-lg text-blue-600" : ""}`} />
          <span className={`text-xs hidden md:block ${isActive("/preferiti") ? "text-blue-600 font-semibold" : ""}`}>Preferiti</span>
        </Link>
        <Link href="/notifiche" className={getLinkClasses("/notifiche")} style={{marginTop: 0}}>
          <div className="relative">
            <Bell className={`h-7 w-7 mb-1 ${isActive("/notifiche") ? "drop-shadow-lg text-blue-600" : ""}`} />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 font-bold shadow-lg animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span className={`text-xs hidden md:block ${isActive("/notifiche") ? "text-blue-600 font-semibold" : ""}`}>Notifiche</span>
        </Link>
        {hasAdvancedAccess && (
          <Link href="/strumenti" className={getLinkClasses("/strumenti")} style={{marginTop: 0}}>
            <Megaphone className={`h-7 w-7 mb-1 ${isActive("/strumenti") ? "drop-shadow-lg text-blue-600" : ""}`} />
            <span className={`text-xs hidden md:block ${isActive("/strumenti") ? "text-blue-600 font-semibold" : ""}`}>Strumenti</span>
          </Link>
        )}
        <Link href="/impostazioni" className={getLinkClasses("/impostazioni")} style={{marginTop: 0}}>
          <Settings className={`h-7 w-7 mb-1 ${isActive("/impostazioni") ? "drop-shadow-lg text-blue-600" : ""}`} />
          <span className={`text-xs hidden md:block ${isActive("/impostazioni") ? "text-blue-600 font-semibold" : ""}`}>Impostazioni</span>
        </Link>
      </div>
    </nav>
  );
}
