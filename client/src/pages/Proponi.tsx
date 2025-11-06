import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Vote, Globe2 } from "lucide-react";
import { useNoScroll } from "@/hooks/useNoScroll";

export default function Proponi() {
  const { user, isLoading } = useAuth();
  
  // Blocca lo scroll della pagina
  useNoScroll(true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-purple-50 to-pink-100 p-4 page-with-navbar">
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
        {/* Titolo */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              <FileText className="h-6 w-6 text-purple-600" />
              Firma
            </CardTitle>
            <CardDescription>
              Utilizza gli strumenti di Democrazia Diretta per modificare la Legge!
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Pulsanti Proposta - Uno sopra l'altro */}
        <div className="flex flex-col gap-6 flex-1 justify-center">
          {/* Iniziative Popolari */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => window.location.href = "/iniziative-popolari"}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#22c55e" />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <FileText className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <FileText className="h-8 w-8 text-green-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none text-center">Iniziativa<br />Popolare</div>
              <div className="text-gray-500 text-xs mt-1 select-none text-center">Firma qui per proporre una nuova legge.</div>
            </div>
          </button>
          {/* Referendum Abrogativi */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => window.location.href = "/referendum-abrogativi"}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#ef4444" />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <Vote className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <Vote className="h-8 w-8 text-red-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none text-center">Referendum<br />Abrogativo</div>
              <div className="text-gray-500 text-xs mt-1 select-none text-center">Firma qui per cancellare una legge ingiusta.</div>
            </div>
          </button>
          {/* ICE */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => window.location.href = "/ice"}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#3b82f6" />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <Globe2 className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <Globe2 className="h-8 w-8 text-blue-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none">ICE</div>
              <div className="text-gray-500 text-xs mt-1 select-none text-center">Firma qui per proporre una nuova legge europea.</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
