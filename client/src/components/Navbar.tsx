import { Settings, Megaphone, Star, Binoculars, PenLine } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";

export default function Navbar() {
  const [location] = useLocation();
  const { user } = useAuth();

  // Funzione per determinare se un link è attivo
  const isActive = (path: string) => location.startsWith(path);

  // Funzione per ottenere le classi CSS di un link
  const getLinkClasses = (path: string) => {
    const baseClasses = "flex flex-col items-center justify-center transition-all duration-200";
    const activeClasses = "text-blue-600 scale-110 font-semibold";
    const inactiveClasses = "text-gray-600 hover:text-blue-500 hover:scale-105";
    
    return `${baseClasses} ${isActive(path) ? activeClasses : inactiveClasses}`;
  };

  // Determina se l'utente ha accesso agli strumenti avanzati
  const userRole = user?.ruolo;
  const hasAdvancedAccess = userRole === "P" || userRole === "C" || userRole === "CP" || userRole === "AD" || userRole === "A" || userRole === "O" || userRole === "I";
  
  // Determina se l'utente ha accesso limitato (solo Evento e Sostenitori)
  const hasLimitedAccess = userRole === "A" || userRole === "O";

  return (
    <nav className="bg-white flex justify-center items-center h-24 pt-3 pb-4 select-none px-4" style={{ boxShadow: '0 -1px 8px 0 rgba(0,0,0,0.03)', paddingBottom: 'calc(1rem + max(env(safe-area-inset-bottom), 56px))', borderTop: 'none' }}>
      <div className="flex items-center justify-center gap-10 max-w-md">
        {userRole !== "I" && (
          <Link href="/preferiti" className={getLinkClasses("/preferiti")} style={{marginTop: 0}}>
            <Star className={`h-7 w-7 mb-1 ${isActive("/preferiti") ? "drop-shadow-lg text-blue-600" : ""}`} />
            <span className={`text-xs hidden md:block ${isActive("/preferiti") ? "text-blue-600 font-semibold" : ""}`}>Preferiti</span>
          </Link>
        )}
        <Link href="/firma" className={getLinkClasses("/firma")} style={{marginTop: 0}}>
          <PenLine className={`h-7 w-7 mb-1 ${isActive("/firma") ? "drop-shadow-lg text-blue-600" : ""}`} />
          <span className={`text-xs hidden md:block ${isActive("/firma") ? "text-blue-600 font-semibold" : ""}`}>Firma</span>
        </Link>
        {hasAdvancedAccess && (
          <Link href="/strumenti" className={getLinkClasses("/strumenti")} style={{marginTop: 0}}>
            <Megaphone className={`h-7 w-7 mb-1 ${isActive("/strumenti") ? "drop-shadow-lg text-blue-600" : ""}`} />
            <span className={`text-xs hidden md:block ${isActive("/strumenti") ? "text-blue-600 font-semibold" : ""}`}>Strumenti</span>
          </Link>
        )}
        <Link href="/avvistamenti" className={getLinkClasses("/avvistamenti")} style={{marginTop: 0}}>
          <Binoculars className={`h-7 w-7 mb-1 ${isActive("/avvistamenti") ? "drop-shadow-lg text-blue-600" : ""}`} />
          <span className={`text-xs hidden md:block ${isActive("/avvistamenti") ? "text-blue-600 font-semibold" : ""}`}>Avvistamenti</span>
        </Link>
        <Link href="/impostazioni" className={getLinkClasses("/impostazioni")} style={{marginTop: 0}}>
          <Settings className={`h-7 w-7 mb-1 ${isActive("/impostazioni") ? "drop-shadow-lg text-blue-600" : ""}`} />
          <span className={`text-xs hidden md:block ${isActive("/impostazioni") ? "text-blue-600 font-semibold" : ""}`}>Impostazioni</span>
        </Link>
      </div>
    </nav>
  );
}
