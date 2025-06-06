import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, LogOut, UserCheck, Vote, BarChart2, ShieldCheck, PieChart, Bell, Trophy, MessageSquare, Settings, Crown, Building2, Scale, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db, auth } from "@/lib/firebase";

export default function Menu() {
  const { user, isLoading, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  
  // Verifica se l'utente è admin
  useEffect(() => {
    const checkIfAdmin = async () => {
      if (!user) return;
      
      try {
        // Cerca l'utente usando l'API che ora utilizza Firebase
        const response = await fetch(`/api/users/${encodeURIComponent(user.email)}`);
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
    <div className="h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20">
      {isLoading ? (
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-4xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Menu Principale
              </CardTitle>
              <CardDescription>
                Benvenuto nell'applicazione DEMOS. Seleziona un'opzione per continuare.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
              <Button 
                className="h-24 text-lg font-medium" 
                variant="default"
                onClick={() => window.location.href = "/profilo"}
              >
                Profilo
              </Button>
              <Button 
                className="h-24 text-lg font-medium" 
                variant="outline"
                onClick={() => window.location.href = "/gestisci-utenti"}
              >
                Gestisci Utenti
              </Button>
              <Button 
                className="h-24 text-lg font-medium" 
                variant="default"
                onClick={() => window.location.href = "/opinioni"}
              >
                Opinioni
              </Button>
              <Button 
                className="h-24 text-lg font-medium" 
                variant="outline"
                onClick={() => window.location.href = "/rappresentanti"}
              >
                <UserCheck className="mr-2 h-5 w-5" />
                Rappresentanti
              </Button>
              <Button 
                className="h-24 text-lg font-medium" 
                variant="default"
                onClick={() => window.location.href = "/elezioni"}
              >
                <Vote className="mr-2 h-5 w-5" />
                Elezioni
              </Button>
              <Button 
                className="h-24 text-lg font-medium" 
                variant="outline"
                onClick={() => window.location.href = "/gestisci-elezioni"}
              >
                <Settings className="mr-2 h-5 w-5" />
                Gestisci Elezioni
              </Button>
              <Button 
                className="h-24 text-lg font-medium" 
                variant="outline"
                onClick={() => window.location.href = "/statistiche-utenti"}
              >
                <BarChart2 className="mr-2 h-5 w-5" />
                Statistiche Utenti
              </Button>
              <Button 
                className="h-24 text-lg font-medium" 
                variant="default"
                onClick={() => window.location.href = "/statistiche-opinioni"}
              >
                <PieChart className="mr-2 h-5 w-5" />
                Statistiche Opinioni
              </Button>
              {(userRole === 'Politico' || userRole === 'Candidato Politico') && (
                <Button 
                  className="h-24 text-lg font-medium" 
                  variant="default"
                  onClick={() => window.location.href = "/comunica"}
                >
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Comunica
                </Button>
              )}
              <Button 
                className="h-24 text-lg font-medium" 
                variant="outline"
                onClick={() => window.location.href = "/notifiche"}
              >
                <Bell className="mr-2 h-5 w-5" />
                Notifiche
              </Button>
              <Button 
                className="h-24 text-lg font-medium" 
                variant="default"
                onClick={() => window.location.href = "/podio-trasparenza"}
              >
                <Trophy className="mr-2 h-5 w-5" />
                Podio Trasparenza
              </Button>
              <Button 
                className="h-24 text-lg font-medium" 
                variant="outline"
                onClick={() => window.location.href = "/capo-di-stato"}
              >
                <Crown className="mr-2 h-5 w-5" />
                Capo di Stato
              </Button>
              <Button 
                className="h-24 text-lg font-medium" 
                variant="default"
                onClick={() => window.location.href = "/governo"}
              >
                <Building2 className="mr-2 h-5 w-5" />
                Governo
              </Button>
              <Button 
                className="h-24 text-lg font-medium" 
                variant="outline"
                onClick={() => window.location.href = "/grazia"}
              >
                <Scale className="mr-2 h-5 w-5" />
                Grazia
              </Button>
              <Button 
                className="h-24 text-lg font-medium" 
                variant="default"
                onClick={() => window.location.href = "/amnistia"}
              >
                <Users className="mr-2 h-5 w-5" />
                Amnistia
              </Button>
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