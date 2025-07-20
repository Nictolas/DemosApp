import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2 } from "lucide-react";

export function Navbar() {
  const { user, isLoading, logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <Link href="/">
              <h1 className="text-3xl font-bold text-primary cursor-pointer">DEMOS</h1>
            </Link>
          </div>

          <nav className="flex items-center space-x-4">
            <Link href="/menu">
              <span className="text-gray-600 hover:text-gray-900 cursor-pointer">Home</span>
            </Link>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-white">
                        {user.email.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 z-[9999]" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.email}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        Utente DEMOS
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem>
                      <Link href="/menu/profilo">
                        Profilo
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/menu">
                        Menu Principale
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/strumenti">
                        Strumenti
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/notifiche">
                        Notifiche
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/podio-trasparenza">
                        Podio Trasparenza
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/impostazioni">
                        Impostazioni
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 cursor-pointer"
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                  >
                    {logoutMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Disconnessione...
                      </>
                    ) : (
                      "Disconnetti"
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/auth">
                <Button variant="outline">Accedi</Button>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}