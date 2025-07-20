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
              {/* Altri pulsanti menu con nuova estetica */}
              <Link href="/profilo" className="w-full">
                <div className="cursor-pointer w-full h-40 rounded-2xl shadow-lg bg-gradient-to-br from-green-100 to-green-200 flex flex-col items-center justify-center transition-transform active:scale-95">
                  <UserCheck className="h-12 w-12 mb-2 text-green-600" />
                  <div className="text-gray-700 font-semibold text-lg">Profilo</div>
                </div>
              </Link>
              <Link href="/opinioni" className="w-full">
                <div className="cursor-pointer w-full h-40 rounded-2xl shadow-lg bg-gradient-to-br from-pink-100 to-pink-200 flex flex-col items-center justify-center transition-transform active:scale-95">
                  <MessageSquare className="h-12 w-12 mb-2 text-pink-600" />
                  <div className="text-gray-700 font-semibold text-lg">Opinioni</div>
                </div>
              </Link>
              <Link href="/rappresentanti" className="w-full">
                <div className="cursor-pointer w-full h-40 rounded-2xl shadow-lg bg-gradient-to-br from-blue-100 to-blue-200 flex flex-col items-center justify-center transition-transform active:scale-95">
                  <Users className="h-12 w-12 mb-2 text-blue-600" />
                  <div className="text-gray-700 font-semibold text-lg">Rappresentanti</div>
                </div>
              </Link>
              <Link href="/elezioni" className="w-full">
                <div className="cursor-pointer w-full h-40 rounded-2xl shadow-lg bg-gradient-to-br from-yellow-100 to-yellow-200 flex flex-col items-center justify-center transition-transform active:scale-95">
                  <Vote className="h-12 w-12 mb-2 text-yellow-600" />
                  <div className="text-gray-700 font-semibold text-lg">Elezioni</div>
                </div>
              </Link>
              <Link href="/strumenti" className="w-full">
                <div className="cursor-pointer w-full h-40 rounded-2xl shadow-lg bg-gradient-to-br from-purple-100 to-purple-200 flex flex-col items-center justify-center transition-transform active:scale-95">
                  <Megaphone className="h-12 w-12 mb-2 text-purple-600" />
                  <div className="text-gray-700 font-semibold text-lg">Strumenti</div>
                </div>
              </Link>
              <Link href="/podio-trasparenza" className="w-full">
                <div className="cursor-pointer w-full h-40 rounded-2xl shadow-lg bg-gradient-to-br from-orange-100 to-orange-200 flex flex-col items-center justify-center transition-transform active:scale-95">
                  <Trophy className="h-12 w-12 mb-2 text-orange-600" />
                  <div className="text-gray-700 font-semibold text-lg">Podio Trasparenza</div>
                </div>
              </Link>
              <Link href="/notifiche" className="w-full">
                <div className="cursor-pointer w-full h-40 rounded-2xl shadow-lg bg-gradient-to-br from-blue-100 to-blue-200 flex flex-col items-center justify-center transition-transform active:scale-95">
                  <Bell className="h-12 w-12 mb-2 text-blue-400" />
                  <div className="text-gray-700 font-semibold text-lg">Notifiche</div>
                </div>
              </Link>
              <Link href="/vota" className="w-full">
                <div className="cursor-pointer w-full h-40 rounded-2xl shadow-lg bg-gradient-to-br from-green-100 to-green-200 flex flex-col items-center justify-center transition-transform active:scale-95">
                  <Vote className="h-12 w-12 mb-2 text-green-600" />
                  <div className="text-gray-700 font-semibold text-lg">Vota</div>
                </div>
              </Link>
              <Link href="/eventi" className="w-full">
                <div className="cursor-pointer w-full h-40 rounded-2xl shadow-lg bg-gradient-to-br from-pink-100 to-pink-200 flex flex-col items-center justify-center transition-transform active:scale-95">
                  <Megaphone className="h-12 w-12 mb-2 text-pink-600" />
                  <div className="text-gray-700 font-semibold text-lg">Eventi</div>
                </div>
              </Link>
              <Link href="/proponi" className="w-full">
                <div className="cursor-pointer w-full h-40 rounded-2xl shadow-lg bg-gradient-to-br from-yellow-100 to-yellow-200 flex flex-col items-center justify-center transition-transform active:scale-95">
                  <FileText className="h-12 w-12 mb-2 text-yellow-600" />
                  <div className="text-gray-700 font-semibold text-lg">Proponi</div>
                </div>
              </Link>
              <Link href="/impostazioni" className="w-full">
                <div className="cursor-pointer w-full h-40 rounded-2xl shadow-lg bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center transition-transform active:scale-95">
                  <Settings className="h-12 w-12 mb-2 text-gray-600" />
                  <div className="text-gray-700 font-semibold text-lg">Impostazioni</div>
                </div>
              </Link>
              {isAdmin && (
                <Link href="/gestisci" className="w-full">
                  <div className="cursor-pointer w-full h-40 rounded-2xl shadow-lg bg-gradient-to-br from-red-100 to-red-200 flex flex-col items-center justify-center transition-transform active:scale-95">
                    <ShieldCheck className="h-12 w-12 mb-2 text-red-600" />
                    <div className="text-gray-700 font-semibold text-lg">Gestisci</div>
                  </div>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}