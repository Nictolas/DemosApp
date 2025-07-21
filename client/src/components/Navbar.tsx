import { Home, MessageSquare, Users, Settings } from "lucide-react";
import { Link } from "wouter";

export default function Navbar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-[9999]">
      <Link href="/menu" className="flex flex-col items-center justify-center text-gray-600 hover:text-primary transition-colors">
        <Home className="h-7 w-7 mb-1" />
        <span className="text-xs">Menu</span>
      </Link>
      <Link href="/opinioni" className="flex flex-col items-center justify-center text-gray-600 hover:text-primary transition-colors">
        <MessageSquare className="h-7 w-7 mb-1" />
        <span className="text-xs">Opinioni</span>
      </Link>
      <Link href="/rappresentanti" className="flex flex-col items-center justify-center text-gray-600 hover:text-primary transition-colors">
        <Users className="h-7 w-7 mb-1" />
        <span className="text-xs">Rappresentanti</span>
      </Link>
      <Link href="/impostazioni" className="flex flex-col items-center justify-center text-gray-600 hover:text-primary transition-colors">
        <Settings className="h-7 w-7 mb-1" />
        <span className="text-xs">Impostazioni</span>
      </Link>
    </nav>
  );
}