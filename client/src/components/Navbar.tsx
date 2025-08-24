import { Home, MessageSquare, Users, Vote, Settings } from "lucide-react";
import { Link } from "wouter";

export default function Navbar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-between items-center h-20 z-[9999] pt-2 pb-3 select-none px-4" style={{ boxShadow: '0 -1px 8px 0 rgba(0,0,0,0.03)' }}>
      <Link href="/menu" className="flex flex-col items-center justify-center text-gray-600 hover:text-primary transition-colors" style={{marginTop: 0}}>
        <Home className="h-7 w-7 mb-0" />
        <span className="text-xs hidden md:block">Menu</span>
      </Link>
      <Link href="/opinioni" className="flex flex-col items-center justify-center text-gray-600 hover:text-primary transition-colors" style={{marginTop: 0}}>
        <MessageSquare className="h-7 w-7 mb-0" />
        <span className="text-xs hidden md:block">Opinioni</span>
      </Link>
      <Link href="/rappresentanti" className="flex flex-col items-center justify-center text-gray-600 hover:text-primary transition-colors" style={{marginTop: 0}}>
        <Users className="h-7 w-7 mb-0" />
        <span className="text-xs hidden md:block">Rappresentanti</span>
      </Link>
      <Link href="/vota" className="flex flex-col items-center justify-center text-gray-600 hover:text-primary transition-colors" style={{marginTop: 0}}>
        <Vote className="h-7 w-7 mb-0" />
        <span className="text-xs hidden md:block">Vota</span>
      </Link>
      <Link href="/impostazioni" className="flex flex-col items-center justify-center text-gray-600 hover:text-primary transition-colors" style={{marginTop: 0}}>
        <Settings className="h-7 w-7 mb-0" />
        <span className="text-xs hidden md:block">Impostazioni</span>
      </Link>
    </nav>
  );
}