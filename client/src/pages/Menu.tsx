import React, { useEffect, useState } from "react";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, LogOut, UserCheck, Vote, BarChart2, ShieldCheck, PieChart, Bell, Trophy, MessageSquare, Settings, Crown, Building2, Scale, Users, FileText, Calendar, Megaphone, AlertCircle, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// Firebase rimosso - dati ora via API Neon
// import { db, auth } from "@/lib/firebase-stub";
import appIcon from '/icona.png';
import { apiRequest } from "@/lib/queryClient";
import AdSenseBanner from "@/components/AdSenseBanner";
import Navbar from "@/components/Navbar";

export default function Menu() {
  const authReady = useAuthReady();
  const { user, isLoading, error, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [, setLocation] = useLocation();
  
  // Determina se l'utente è admin direttamente dai dati dell'utente
  const isAdmin = user?.role === 'Admin' || user?.ruolo === 'Admin';

  // Funzione per navigare con effetto "ripristino pulsante"
  const navigateWithButtonReset = (path: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    
    // Aggiungi classe per effetto "premuto" (schiacciato)
    button.classList.add('scale-95', 'shadow-md');
    
    // Dopo 150ms, ripristina il pulsante allo stato originale
    setTimeout(() => {
      button.classList.remove('scale-95', 'shadow-md');
      
      // Dopo altri 100ms (quando il pulsante è tornato normale), naviga
      setTimeout(() => {
        setLocation(path);
      }, 100);
    }, 150);
  };

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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white select-none" style={{ paddingBottom: '80px' }}>
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
            <CardContent className="grid grid-cols-2 gap-3 p-6">
              {/* Altri pulsanti menu con nuova estetica */}
                             <button
                 type="button"
                 className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
                 onMouseDown={(e) => {
                   e.currentTarget.classList.add('scale-95', 'shadow-md');
                 }}
                 onMouseUp={(e) => {
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   setTimeout(() => setLocation("/elezioni"), 100);
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                 }}
                 onTouchStart={(e) => {
                   e.preventDefault(); // Previene il comportamento predefinito
                   e.currentTarget.classList.add('scale-95', 'shadow-md');
                 }}
                 onTouchEnd={(e) => {
                   e.preventDefault(); // Previene il comportamento predefinito
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   setTimeout(() => setLocation("/elezioni"), 100);
                 }}
                 onContextMenu={e => e.preventDefault()}
               >
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polygon points="100,0 0,0 0,35 100,20" fill="#fef9c3" />
                  <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
                </svg>
                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                  <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                    <Vote className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                    <Vote className="h-8 w-8 text-yellow-600 relative z-10" />
                  </span>
                  <div className="text-gray-700 font-semibold text-lg select-none">Elezioni</div>
                </div>
              </button>
                             <button
                 type="button"
                 className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
                 onMouseDown={(e) => {
                   e.currentTarget.classList.add('scale-95', 'shadow-md');
                 }}
                 onMouseUp={(e) => {
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   setTimeout(() => setLocation("/strumenti"), 100);
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                 }}
                 onTouchStart={(e) => {
                   e.preventDefault(); // Previene il comportamento predefinito
                   e.currentTarget.classList.add('scale-95', 'shadow-md');
                 }}
                 onTouchEnd={(e) => {
                   e.preventDefault(); // Previene il comportamento predefinito
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   setTimeout(() => setLocation("/strumenti"), 100);
                 }}
                 onContextMenu={e => e.preventDefault()}
               >
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polygon points="100,0 0,0 0,35 100,20" fill="#ede9fe" />
                  <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
                </svg>
                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                  <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                    <Megaphone className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                    <Megaphone className="h-8 w-8 text-purple-600 relative z-10" />
                  </span>
                  <div className="text-gray-700 font-semibold text-lg select-none">Strumenti</div>
                </div>
              </button>
                             <button
                 type="button"
                 className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
                 onMouseDown={(e) => {
                   e.currentTarget.classList.add('scale-95', 'shadow-md');
                 }}
                 onMouseUp={(e) => {
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   setTimeout(() => setLocation("/podio-trasparenza"), 100);
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                 }}
                 onTouchStart={(e) => {
                   e.preventDefault(); // Previene il comportamento predefinito
                   e.currentTarget.classList.add('scale-95', 'shadow-md');
                 }}
                 onTouchEnd={(e) => {
                   e.preventDefault(); // Previene il comportamento predefinito
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   setTimeout(() => setLocation("/podio-trasparenza"), 100);
                 }}
                 onContextMenu={e => e.preventDefault()}
               >
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polygon points="100,0 0,0 0,35 100,20" fill="#fef3c7" />
                  <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
                </svg>
                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                  <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                    <Trophy className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                    <Trophy className="h-8 w-8 text-orange-600 relative z-10" />
                  </span>
                  <div className="text-gray-700 font-semibold text-lg select-none">Podio Trasparenza</div>
                </div>
              </button>
                             <button
                 type="button"
                 className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
                 onMouseDown={(e) => {
                   e.currentTarget.classList.add('scale-95', 'shadow-md');
                 }}
                 onMouseUp={(e) => {
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   setTimeout(() => setLocation("/notifiche"), 100);
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                 }}
                 onTouchStart={(e) => {
                   e.preventDefault(); // Previene il comportamento predefinito
                   e.currentTarget.classList.add('scale-95', 'shadow-md');
                 }}
                 onTouchEnd={(e) => {
                   e.preventDefault(); // Previene il comportamento predefinito
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   setTimeout(() => setLocation("/notifiche"), 100);
                 }}
                 onContextMenu={e => e.preventDefault()}
               >
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polygon points="100,0 0,0 0,35 100,20" fill="#bae6fd" />
                  <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
                </svg>
                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                  <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                    <Bell className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                    <Bell className="h-8 w-8 text-blue-400 relative z-10" />
                  </span>
                  <div className="text-gray-700 font-semibold text-lg select-none">Notifiche</div>
                </div>
              </button>
                             <button
                 type="button"
                 className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
                 onMouseDown={(e) => {
                   e.currentTarget.classList.add('scale-95', 'shadow-md');
                 }}
                 onMouseUp={(e) => {
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   setTimeout(() => setLocation("/vota"), 100);
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                 }}
                 onTouchStart={(e) => {
                   e.preventDefault(); // Previene il comportamento predefinito
                   e.currentTarget.classList.add('scale-95', 'shadow-md');
                 }}
                 onTouchEnd={(e) => {
                   e.preventDefault(); // Previene il comportamento predefinito
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   setTimeout(() => setLocation("/vota"), 100);
                 }}
                 onContextMenu={e => e.preventDefault()}
               >
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polygon points="100,0 0,0 0,35 100,20" fill="#bbf7d0" />
                  <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
                </svg>
                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                  <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                    <Vote className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                    <Vote className="h-8 w-8 text-green-600 relative z-10" />
                  </span>
                  <div className="text-gray-700 font-semibold text-lg select-none">Vota</div>
                </div>
              </button>
                             <button
                 type="button"
                 className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
                 onMouseDown={(e) => {
                   e.currentTarget.classList.add('scale-95', 'shadow-md');
                 }}
                 onMouseUp={(e) => {
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   setTimeout(() => setLocation("/eventi"), 100);
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                 }}
                 onTouchStart={(e) => {
                   e.preventDefault(); // Previene il comportamento predefinito
                   e.currentTarget.classList.add('scale-95', 'shadow-md');
                 }}
                 onTouchEnd={(e) => {
                   e.preventDefault(); // Previene il comportamento predefinito
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   setTimeout(() => setLocation("/eventi"), 100);
                 }}
                 onContextMenu={e => e.preventDefault()}
               >
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polygon points="100,0 0,0 0,35 100,20" fill="#fbcfe8" />
                  <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
                </svg>
                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                  <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                    <Megaphone className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                    <Megaphone className="h-8 w-8 text-pink-600 relative z-10" />
                  </span>
                  <div className="text-gray-700 font-semibold text-lg select-none">Eventi</div>
                </div>
              </button>
                             <button
                 type="button"
                 className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
                 onMouseDown={(e) => {
                   e.currentTarget.classList.add('scale-95', 'shadow-md');
                 }}
                 onMouseUp={(e) => {
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   setTimeout(() => setLocation("/proponi"), 100);
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                 }}
                 onTouchStart={(e) => {
                   e.preventDefault(); // Previene il comportamento predefinito
                   e.currentTarget.classList.add('scale-95', 'shadow-md');
                 }}
                 onTouchEnd={(e) => {
                   e.preventDefault(); // Previene il comportamento predefinito
                   e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   setTimeout(() => setLocation("/proponi"), 100);
                 }}
                 onContextMenu={e => e.preventDefault()}
               >
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polygon points="100,0 0,0 0,35 100,20" fill="#fef9c3" />
                  <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
                </svg>
                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                  <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                    <FileText className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                    <FileText className="h-8 w-8 text-yellow-600 relative z-10" />
                  </span>
                  <div className="text-gray-700 font-semibold text-lg select-none">Proponi</div>
                </div>
              </button>
                             {isAdmin && (
                 <button
                   type="button"
                   className="relative w-full h-40 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
                   onMouseDown={(e) => {
                     e.currentTarget.classList.add('scale-95', 'shadow-md');
                   }}
                   onMouseUp={(e) => {
                     e.currentTarget.classList.remove('scale-95', 'shadow-md');
                     setTimeout(() => setLocation("/gestisci"), 100);
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.classList.remove('scale-95', 'shadow-md');
                   }}
                   onTouchStart={(e) => {
                     e.preventDefault(); // Previene il comportamento predefinito
                     e.currentTarget.classList.add('scale-95', 'shadow-md');
                   }}
                   onTouchEnd={(e) => {
                     e.preventDefault(); // Previene il comportamento predefinito
                     e.currentTarget.classList.remove('scale-95', 'shadow-md');
                     setTimeout(() => setLocation("/gestisci"), 100);
                 }}
                   onContextMenu={e => e.preventDefault()}
                 >
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points="100,0 0,0 0,35 100,20" fill="#fecaca" />
                    <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                      <ShieldCheck className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                      <ShieldCheck className="h-8 w-8 text-red-600 relative z-10" />
                    </span>
                    <div className="text-gray-700 font-semibold text-lg select-none">Gestisci</div>
                  </div>
                </button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}