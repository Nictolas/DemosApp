import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { AccessControlProps } from "./types";
import { hasAdvancedAccess, getUserRole } from "./utils";

export function AccessControl({ user, children }: AccessControlProps) {
  // Check if user has advanced access
  if (!hasAdvancedAccess(user)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 page-with-navbar">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="flex items-center gap-2"
            >
              Torna Indietro
            </Button>
          </div>

          {/* Titolo */}
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                Accesso Negato
              </CardTitle>
              <CardDescription>
                Questa pagina è riservata a Politici, Candidati, Candidati Politici e Admin
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Messaggio di accesso negato */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Accesso negato</AlertTitle>
            <AlertDescription>
              La pagina "Strumenti" è disponibile solo per utenti con ruoli avanzati.
              Il tuo ruolo attuale: {getUserRole(user)}.
              Per accedere a questa pagina, contatta un amministratore per aggiornare il tuo ruolo.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
