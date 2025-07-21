import { Home, MessageSquare, Users, Settings } from "lucide-react";
import { Link } from "wouter";

export default function Navbar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-20 z-[9999] pt-2" style={{ boxShadow: '0 -1px 8px 0 rgba(0,0,0,0.03)' }}>
      <Link href="/menu" className="flex flex-col items-center justify-center text-gray-600 hover:text-primary transition-colors" style={{marginTop: 2}}>
        <Home className="h-7 w-7 mb-1" />
        <span className="text-xs">Menu</span>
      </Link>
      <Link href="/opinioni" className="flex flex-col items-center justify-center text-gray-600 hover:text-primary transition-colors" style={{marginTop: 2}}>
        <MessageSquare className="h-7 w-7 mb-1" />
        <span className="text-xs">Opinioni</span>
      </Link>
      <Link href="/rappresentanti" className="flex flex-col items-center justify-center text-gray-600 hover:text-primary transition-colors" style={{marginTop: 2}}>
        <Users className="h-7 w-7 mb-1" />
        <span className="text-xs">Rappresentanti</span>
      </Link>
      <Link href="/impostazioni" className="flex flex-col items-center justify-center text-gray-600 hover:text-primary transition-colors" style={{marginTop: 2}}>
        <Settings className="h-7 w-7 mb-1" />
        <span className="text-xs">Impostazioni</span>
      </Link>
    </nav>
  );
}