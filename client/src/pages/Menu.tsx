import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BarChart2, MessageSquare, Megaphone, FileText, Home } from "lucide-react";
// Firebase rimosso - dati ora via API Neon
// import { db, auth } from "@/lib/firebase-stub";
// import appIcon from '../../public/icona.png';
import Navbar from "@/components/Navbar";

export default function Menu() {
  const { user, isLoading } = useAuth();
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

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white select-none overflow-hidden" style={{ paddingBottom: '80px' }}>
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="container mx-auto px-4 py-4 h-full flex flex-col">
          <Card className="w-full max-w-4xl mx-auto flex-1 flex flex-col">
            <CardHeader className="text-center flex-shrink-0 pt-6 pb-4">
              <img 
                src="https://demos.it/icona.png" 
                alt="Logo Demos" 
                className={`w-20 h-20 mx-auto mb-3 ${isAdmin ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                onClick={isAdmin ? () => setLocation("/gestisci") : undefined}
              />
              <CardTitle className="text-2xl font-bold text-gray-800 mb-2">
                Menu Principale
              </CardTitle>
              <CardDescription className="text-gray-600">
                Benvenuto nell'applicazione DEMOS. Seleziona un'opzione per continuare.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 p-4 flex-1">
              {/* Altri pulsanti menu con nuova estetica */}
                             <button
                 type="button"
                 className="relative w-full h-32 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
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
                                     <span className="relative flex items-center justify-center w-12 h-12 mb-2">
                     <BarChart2 className="h-10 w-10 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                     <BarChart2 className="h-6 w-6 text-yellow-600 relative z-10" />
                   </span>
                  <div className="text-gray-700 font-semibold text-lg select-none">Elezioni</div>
                </div>
              </button>
                                                           <button
                 type="button"
                 className="relative w-full h-32 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
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
                  <span className="relative flex items-center justify-center w-12 h-12 mb-2">
                    <Megaphone className="h-10 w-10 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                    <Megaphone className="h-6 w-6 text-purple-600 relative z-10" />
                  </span>
                  <div className="text-gray-700 font-semibold text-lg select-none">Strumenti</div>
                </div>
              </button>

              <button
                 type="button"
                 className="relative w-full h-32 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
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
                  <span className="relative flex items-center justify-center w-12 h-12 mb-2">
                    <Megaphone className="h-10 w-10 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                    <Megaphone className="h-6 w-6 text-pink-600 relative z-10" />
                  </span>
                  <div className="text-gray-700 font-semibold text-lg select-none">Eventi</div>
                </div>
              </button>
                                                           <button
                 type="button"
                 className="relative w-full h-32 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
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
                  <span className="relative flex items-center justify-center w-12 h-12 mb-2">
                    <FileText className="h-10 w-10 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                    <FileText className="h-6 w-6 text-yellow-600 relative z-10" />
                  </span>
                  <div className="text-gray-700 font-semibold text-lg select-none">Proponi</div>
                </div>
              </button>

            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}