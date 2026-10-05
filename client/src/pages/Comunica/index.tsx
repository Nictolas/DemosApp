import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAccessControl } from "./hooks/useAccessControl";
import { useComunicaData } from "./hooks/useComunicaData";
import { AccessDenied } from "./components/AccessDenied";
import { NavigationButtons } from "./components/NavigationButtons";
import { UltimaComunicazioneComponent } from "./components/UltimaComunicazione";
import { ComunicaForm } from "./components/ComunicaForm";

export default function Comunica() {
  const [, setLocation] = useLocation();
  const { user, hasAdvancedAccess, canAccessProgramma } = useAccessControl();
  const { ultimaComunicazione, isLoadingUltima } = useComunicaData();

  // Show loading while user data is being fetched
  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Caricamento dati utente...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Blocca completamente l'accesso per utenti "Elettore"
  if (!hasAdvancedAccess) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 page-with-navbar">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setLocation("/menu")}
            className="flex items-center gap-2"
          >
            Torna al Menu
          </Button>
        </div>

        {/* Form Comunicazione */}
        <ComunicaForm />

        {/* Pulsanti Navigazione */}
        <NavigationButtons canAccessProgramma={canAccessProgramma} />

        {/* Ultima Comunicazione Section */}
        {!isLoadingUltima && ultimaComunicazione && (
          <UltimaComunicazioneComponent ultimaComunicazione={ultimaComunicazione} />
        )}
      </div>
    </div>
  );
}
