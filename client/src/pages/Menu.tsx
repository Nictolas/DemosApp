import React, { useEffect, useState } from "react";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, LogOut, UserCheck, Vote, BarChart2, ShieldCheck, PieChart, Bell, Trophy, MessageSquare, Settings, Crown, Building2, Scale, Users, FileText, Calendar, Megaphone, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db, auth } from "@/lib/firebase";
import appIcon from '/icona.png';
import { apiRequest } from "@/lib/queryClient";
import AdSenseBanner from "@/components/AdSenseBanner";

export default function Menu() {
  const authReady = useAuthReady();
  const { user, isLoading, error, logoutMutation } = useAuth();
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
        // Usa apiRequest per inviare il token Firebase
        const response = await apiRequest("GET", `/api/users/${encodeURIComponent(user.uid)}`);
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
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
              {/* Pulsante Pesca Misteriosa */}
              <div className="relative w-full h-40 rounded-2xl shadow-lg bg-gradient-to-br from-yellow-100 to-orange-100 flex flex-col items-center justify-center col-span-1">
                <div className="mb-2 mt-2">
                  {/* Sostituisci con la tua icona personalizzata se disponibile */}
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="12" height="12" rx="3" fill="#FBBF24"/>
                    <rect x="18" y="18" width="12" height="12" rx="3" fill="#F59E42"/>
                    <rect x="30" y="6" width="12" height="12" rx="3" fill="#FBBF24"/>
                    <rect x="6" y="30" width="12" height="12" rx="3" fill="#F59E42"/>
                  </svg>
                </div>
                <div className="text-gray-700 font-semibold text-lg">Pesca misteriosa</div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                  {/* Badge tempo */}
                  <div className="flex items-center bg-white/80 rounded-full px-2 py-1 text-xs shadow">
                    <svg className="w-4 h-4 text-yellow-500 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2 2m8-2a10 10 0 11-20 0 10 10 0 0120 0z" /></svg>
                    03 h 30 m
                  </div>
                </div>
              </div>
              {/* Pulsante Negozio */}
              <div className="w-full h-40 rounded-2xl shadow-lg bg-gradient-to-br from-blue-100 to-purple-100 flex flex-col items-center justify-center col-span-1">
                <div className="mb-2 mt-2">
                  {/* Sostituisci con la tua icona personalizzata se disponibile */}
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="10" y="14" width="28" height="20" rx="4" fill="#A5B4FC"/>
                    <path d="M14 14V10a4 4 0 014-4h12a4 4 0 014 4v4" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="text-gray-700 font-semibold text-lg opacity-70">Negozio</div>
              </div>
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
              
              <Link href="/strumenti">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Megaphone className="h-5 w-5" />
                  Strumenti
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
              
              <Link href="/eventi">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Megaphone className="h-5 w-5" />
                  Eventi
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
              <Link href="/impostazioni">
                <Button 
                  className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                  variant="outline"
                >
                  <Settings className="h-5 w-5" />
                  Impostazioni
                </Button>
              </Link>

              {/* Scadenze tecniche */}
              {/* RIMOSSO: la voce Scadenze va solo nella pagina Gestisci */}
              
              {/* Sostenitori: rimuovere da qui */}
              {/* {(userRole === 'Politico' || userRole === 'Candidato' || userRole === 'Candidato Politico') && (
                <Link href="/sostenitori">
                  <Button 
                    className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                    variant="outline"
                  >
                    <Users className="h-5 w-5" />
                    Sostenitori
                  </Button>
                </Link>
              )} */}
              
              {isAdmin && (
                <Link href="/gestisci">
                  <Button 
                    className="h-20 text-sm font-medium w-full flex flex-col items-center gap-1" 
                    variant="outline"
                  >
                    <ShieldCheck className="h-5 w-5" />
                    Gestisci
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
          <AdSenseBanner />
        </div>
      )}
    </div>
  );
}