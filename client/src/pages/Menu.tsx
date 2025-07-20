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
                <div className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer">
                  {/* Sfondo diagonale */}
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points="0,0 100,0 100,60 0,100" fill="#bbf7d0" />
                    <polygon points="0,100 100,60 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                      <svg className="absolute w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="10,10 90,10 90,60 10,90" stroke="#bbf7d0" strokeWidth="4" fill="none" />
                      </svg>
                      <UserCheck className="h-8 w-8 text-green-600 relative z-10" />
                    </span>
                    <div className="text-gray-700 font-semibold text-lg">Profilo</div>
                  </div>
                </div>
              </Link>
              <Link href="/opinioni" className="w-full">
                <div className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points="0,0 100,0 100,60 0,100" fill="#fbcfe8" />
                    <polygon points="0,100 100,60 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                      <svg className="absolute w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="10,10 90,10 90,60 10,90" stroke="#fbcfe8" strokeWidth="4" fill="none" />
                      </svg>
                      <MessageSquare className="h-8 w-8 text-pink-600 relative z-10" />
                    </span>
                    <div className="text-gray-700 font-semibold text-lg">Opinioni</div>
                  </div>
                </div>
              </Link>
              <Link href="/rappresentanti" className="w-full">
                <div className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points="0,0 100,0 100,60 0,100" fill="#dbeafe" />
                    <polygon points="0,100 100,60 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                      <svg className="absolute w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="10,10 90,10 90,60 10,90" stroke="#dbeafe" strokeWidth="4" fill="none" />
                      </svg>
                      <Users className="h-8 w-8 text-blue-600 relative z-10" />
                    </span>
                    <div className="text-gray-700 font-semibold text-lg">Rappresentanti</div>
                  </div>
                </div>
              </Link>
              <Link href="/elezioni" className="w-full">
                <div className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points="0,0 100,0 100,60 0,100" fill="#fef9c3" />
                    <polygon points="0,100 100,60 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                      <svg className="absolute w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="10,10 90,10 90,60 10,90" stroke="#fef9c3" strokeWidth="4" fill="none" />
                      </svg>
                      <Vote className="h-8 w-8 text-yellow-600 relative z-10" />
                    </span>
                    <div className="text-gray-700 font-semibold text-lg">Elezioni</div>
                  </div>
                </div>
              </Link>
              <Link href="/strumenti" className="w-full">
                <div className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points="0,0 100,0 100,60 0,100" fill="#ede9fe" />
                    <polygon points="0,100 100,60 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                      <svg className="absolute w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="10,10 90,10 90,60 10,90" stroke="#ede9fe" strokeWidth="4" fill="none" />
                      </svg>
                      <Megaphone className="h-8 w-8 text-purple-600 relative z-10" />
                    </span>
                    <div className="text-gray-700 font-semibold text-lg">Strumenti</div>
                  </div>
                </div>
              </Link>
              <Link href="/podio-trasparenza" className="w-full">
                <div className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points="0,0 100,0 100,60 0,100" fill="#fef3c7" />
                    <polygon points="0,100 100,60 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                      <svg className="absolute w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="10,10 90,10 90,60 10,90" stroke="#fef3c7" strokeWidth="4" fill="none" />
                      </svg>
                      <Trophy className="h-8 w-8 text-orange-600 relative z-10" />
                    </span>
                    <div className="text-gray-700 font-semibold text-lg">Podio Trasparenza</div>
                  </div>
                </div>
              </Link>
              <Link href="/notifiche" className="w-full">
                <div className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points="0,0 100,0 100,60 0,100" fill="#bae6fd" />
                    <polygon points="0,100 100,60 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                      <svg className="absolute w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="10,10 90,10 90,60 10,90" stroke="#bae6fd" strokeWidth="4" fill="none" />
                      </svg>
                      <Bell className="h-8 w-8 text-blue-400 relative z-10" />
                    </span>
                    <div className="text-gray-700 font-semibold text-lg">Notifiche</div>
                  </div>
                </div>
              </Link>
              <Link href="/vota" className="w-full">
                <div className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points="0,0 100,0 100,60 0,100" fill="#bbf7d0" />
                    <polygon points="0,100 100,60 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                      <svg className="absolute w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="10,10 90,10 90,60 10,90" stroke="#bbf7d0" strokeWidth="4" fill="none" />
                      </svg>
                      <Vote className="h-8 w-8 text-green-600 relative z-10" />
                    </span>
                    <div className="text-gray-700 font-semibold text-lg">Vota</div>
                  </div>
                </div>
              </Link>
              <Link href="/eventi" className="w-full">
                <div className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points="0,0 100,0 100,60 0,100" fill="#fbcfe8" />
                    <polygon points="0,100 100,60 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                      <svg className="absolute w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="10,10 90,10 90,60 10,90" stroke="#fbcfe8" strokeWidth="4" fill="none" />
                      </svg>
                      <Megaphone className="h-8 w-8 text-pink-600 relative z-10" />
                    </span>
                    <div className="text-gray-700 font-semibold text-lg">Eventi</div>
                  </div>
                </div>
              </Link>
              <Link href="/proponi" className="w-full">
                <div className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points="0,0 100,0 100,60 0,100" fill="#fef9c3" />
                    <polygon points="0,100 100,60 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                      <svg className="absolute w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="10,10 90,10 90,60 10,90" stroke="#fef9c3" strokeWidth="4" fill="none" />
                      </svg>
                      <FileText className="h-8 w-8 text-yellow-600 relative z-10" />
                    </span>
                    <div className="text-gray-700 font-semibold text-lg">Proponi</div>
                  </div>
                </div>
              </Link>
              <Link href="/impostazioni" className="w-full">
                <div className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points="0,0 100,0 100,60 0,100" fill="#f3f4f6" />
                    <polygon points="0,100 100,60 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                      <svg className="absolute w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="10,10 90,10 90,60 10,90" stroke="#f3f4f6" strokeWidth="4" fill="none" />
                      </svg>
                      <Settings className="h-8 w-8 text-gray-600 relative z-10" />
                    </span>
                    <div className="text-gray-700 font-semibold text-lg">Impostazioni</div>
                  </div>
                </div>
              </Link>
              {isAdmin && (
                <Link href="/gestisci" className="w-full">
                  <div className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      <polygon points="0,0 100,0 100,60 0,100" fill="#fecaca" />
                      <polygon points="0,100 100,60 100,100" fill="#fff" />
                    </svg>
                    <div className="relative z-10 flex flex-col items-center justify-center h-full">
                      <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                        <svg className="absolute w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <polygon points="10,10 90,10 90,60 10,90" stroke="#fecaca" strokeWidth="4" fill="none" />
                        </svg>
                        <ShieldCheck className="h-8 w-8 text-red-600 relative z-10" />
                      </span>
                      <div className="text-gray-700 font-semibold text-lg">Gestisci</div>
                    </div>
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