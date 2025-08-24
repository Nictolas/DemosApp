import { Home, MessageSquare, Users, Vote, Settings, Bell } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Navbar() {
  const [location] = useLocation();

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
    const activeClasses = "text-primary scale-110";
    const inactiveClasses = "text-gray-600 hover:text-primary hover:scale-105";
    
    return `${baseClasses} ${isActive(path) ? activeClasses : inactiveClasses}`;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-between items-center h-20 z-[9999] pt-2 pb-3 select-none px-4" style={{ boxShadow: '0 -1px 8px 0 rgba(0,0,0,0.03)' }}>
      <Link href="/menu" className={getLinkClasses("/menu")} style={{marginTop: 0}}>
        <Home className={`h-7 w-7 mb-0 ${isActive("/menu") ? "drop-shadow-sm" : ""}`} />
        <span className="text-xs hidden md:block">Menu</span>
      </Link>
      <Link href="/opinioni" className={getLinkClasses("/opinioni")} style={{marginTop: 0}}>
        <MessageSquare className={`h-7 w-7 mb-0 ${isActive("/opinioni") ? "drop-shadow-sm" : ""}`} />
        <span className="text-xs hidden md:block">Opinioni</span>
      </Link>
      <Link href="/rappresentanti" className={getLinkClasses("/rappresentanti")} style={{marginTop: 0}}>
        <Users className={`h-7 w-7 mb-0 ${isActive("/rappresentanti") ? "drop-shadow-sm" : ""}`} />
        <span className="text-xs hidden md:block">Rappresentanti</span>
      </Link>
      <Link href="/notifiche" className={getLinkClasses("/notifiche")} style={{marginTop: 0}}>
        <Bell className={`h-7 w-7 mb-0 ${isActive("/notifiche") ? "drop-shadow-sm" : ""}`} />
        <span className="text-xs hidden md:block">Notifiche</span>
      </Link>
      <Link href="/vota" className={getLinkClasses("/vota")} style={{marginTop: 0}}>
        <Vote className={`h-7 w-7 mb-0 ${isActive("/vota") ? "drop-shadow-sm" : ""}`} />
        <span className="text-xs hidden md:block">Vota</span>
      </Link>
      <Link href="/impostazioni" className={getLinkClasses("/impostazioni")} style={{marginTop: 0}}>
        <Settings className={`h-7 w-7 mb-0 ${isActive("/impostazioni") ? "drop-shadow-sm" : ""}`} />
        <span className="text-xs hidden md:block">Impostazioni</span>
      </Link>
    </nav>
  );
}