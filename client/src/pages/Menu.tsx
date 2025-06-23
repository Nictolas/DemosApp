import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, LogOut, UserCheck, Vote, BarChart2, ShieldCheck, PieChart, Bell, Trophy, MessageSquare, Settings, Crown, Building2, Scale, Users, FileText, Calendar, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db, auth } from "@/lib/firebase";
import appIcon from '/icona.png';

export default function Menu() {
  const { user, isLoading, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [, setLocation] = useLocation();
  
  // Verifica se l'utente è admin
  useEffect(() => {
    const checkIfAdmin = async () => {
      if (!user) return;
      
      try {
        // Cerca l'utente usando l'API che ora utilizza Firebase
        const response = await fetch(`/api/users/${encodeURIComponent(user.uid)}`);
        if (response.ok) {
          const userData = await response.json();
          setIsAdmin(userData?.ruolo === 'Admin');
          setUserRole(userData?.ruolo || '');
        } else {
          console.error("Errore nel verificare il ruolo");
        }
      } catch (error) {
        console.error("Errore:", error);
      }
    };
    
    checkIfAdmin();
  }, [user]);

  // Funzione per effettuare il logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutMutation.mutateAsync();
      toast({
        title: "Logout effettuato",
        description: "Sei stato disconnesso con successo.",
        variant: "default",
      });
      // Redirect avviene automaticamente grazie alla protezione delle rotte
    } catch (error) {
      console.error("Errore durante il logout:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il logout.",
        variant: "destructive",
      });
      setIsLoggingOut(false);
    }
  };

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-b from-background to-secondary/20">
      {isLoading ? (
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-4xl mx-auto">
            <CardHeader className="text-center">
              <img 
                src={appIcon} 
                alt="Logo Demos" 
                className="w-24 h-24 mx-auto mb-4" 
              />
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Menu Principale
              </CardTitle>
              <CardDescription>
                Benvenuto nell'applicazione DEMOS. Seleziona un'opzione per continuare.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 p-6">
              <Link href="/profilo">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="default"
                >
                  <UserCheck className="h-5 w-5" />
                  Profilo
                </Button>
              </Link>
              
              <Link href="/opinioni">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <MessageSquare className="h-5 w-5" />
                  Opinioni
                </Button>
              </Link>
              
              <Link href="/rappresentanti">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Users className="h-5 w-5" />
                  Rappresentanti
                </Button>
              </Link>
              
              <Link href="/elezioni">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Vote className="h-5 w-5" />
                  Elezioni
                </Button>
              </Link>
              
              <Link href="/statistiche">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <BarChart2 className="h-5 w-5" />
                  Statistiche
                </Button>
              </Link>
              
              <Link href="/gestisci">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Settings className="h-5 w-5" />
                  Gestisci
                </Button>
              </Link>
              
              <Link href="/comunica">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Megaphone className="h-5 w-5" />
                  Comunica
                </Button>
              </Link>
              
              <Link href="/podio-trasparenza">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Trophy className="h-5 w-5" />
                  Podio Trasparenza
                </Button>
              </Link>
              
              <Link href="/notifiche">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Bell className="h-5 w-5" />
                  Notifiche
                </Button>
              </Link>
              
              <Link href="/vota">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Vote className="h-5 w-5" />
                  Vota
                </Button>
              </Link>
              
              <Link href="/capo-di-stato">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Crown className="h-5 w-5" />
                  Capo di Stato
                </Button>
              </Link>
              
              <Link href="/governo">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Building2 className="h-5 w-5" />
                  Governo
                </Button>
              </Link>
              
              <Link href="/grazia">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Scale className="h-5 w-5" />
                  Grazia
                </Button>
              </Link>
              
              <Link href="/amnistia">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <FileText className="h-5 w-5" />
                  Amnistia
                </Button>
              </Link>
              
              <Link href="/comizi">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Megaphone className="h-5 w-5" />
                  Comizi
                </Button>
              </Link>
              
              <Link href="/proponi">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <FileText className="h-5 w-5" />
                  Proponi
                </Button>
              </Link>
              
              <Link href="/iniziative-popolari">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Users className="h-5 w-5" />
                  Iniziative Popolari
                </Button>
              </Link>
              
              <Link href="/referendum-abrogativi">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Vote className="h-5 w-5" />
                  Referendum Abrogativi
                </Button>
              </Link>
              
              {(userRole === 'Politico' || userRole === 'Candidato' || userRole === 'Candidato Politico') && (
                <Link href="/sostenitori">
                  <Button 
                    className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                    variant="outline"
                  >
                    <Users className="h-5 w-5" />
                    Sostenitori
                  </Button>
                </Link>
              )}
              {isAdmin && (
                <Button 
                  className="h-24 text-lg font-medium md:col-span-2" 
                  variant="outline"
                  onClick={() => {}}
                >
                  <ShieldCheck className="mr-2 h-5 w-5" />
                  Amministrazione
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full justify-start mb-2"
                onClick={() => setLocation("/limiti")}
              >
                Limiti
              </Button>
            </CardContent>
            <CardFooter className="flex justify-center p-6 pt-0">
              <Button 
                variant="destructive" 
                className="w-full max-w-sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disconnessione in corso...
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2 h-4 w-4" />
                    Disconnetti
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}