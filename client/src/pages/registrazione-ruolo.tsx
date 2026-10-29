import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function RegistrazioneRuolo() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  // Ruolo automaticamente impostato a "Elettore" per tutti i nuovi utenti

  const handleComplete = async () => {
    try {
      // Utente Passkey: account già creato, non chiamare /api/auth/register
      const isPasskeyUser = typeof window !== "undefined" && window.localStorage.getItem("webauthn_user_id") && !window.localStorage.getItem("registrazione_email");
      if (isPasskeyUser) {
        try {
          const profiloLocale = {
            cittadinanza: localStorage.getItem("registrazione_cittadinanza"),
            paese_residenza: localStorage.getItem("registrazione_paese_residenza"),
            regione_residenza: localStorage.getItem("registrazione_regione_residenza"),
            provincia_residenza: localStorage.getItem("registrazione_provincia_residenza"),
            comune_residenza: localStorage.getItem("registrazione_comune_residenza"),
          };
          window.localStorage.setItem("profilo_locale", JSON.stringify(profiloLocale));
        } catch (_) {}
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("registrazione_")) localStorage.removeItem(key);
        });
        toast({ title: "Registrazione completata!", description: "Benvenuto su Demos." });
        navigate("/profilo");
        return;
      }

      // Flusso email/password disabilitato: la registrazione avviene solo tramite passkey
      toast({
        title: "Registrazione non disponibile",
        description: "La registrazione con email e password è stata disabilitata. Usa il flusso con passkey dalla schermata iniziale.",
        variant: "destructive",
      });
      navigate("/auth");
    } catch (error) {
      console.error('Errore nella registrazione:', error);
      toast({
        title: "Errore",
        description: "Impossibile completare la registrazione. Riprova più tardi.",
        variant: "destructive",
      });
    }
  };

  // Tutti i nuovi utenti sono automaticamente "Elettore" - nessun campo aggiuntivo necessario

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              Completamento Registrazione
            </CardTitle>
            <CardDescription className="text-center">
              Completa la tua registrazione come Elettore
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Informazione Ruolo */}
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🙋‍♂️</span>
                  <div>
                    <div className="font-semibold text-blue-900">Ruolo: Elettore</div>
                    <div className="text-sm text-blue-700 mt-1">Tutti i nuovi utenti vengono registrati automaticamente come Elettore</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pulsante Continua */}
            <div className="flex justify-center pt-6">
              <Button
                onClick={handleComplete}
                className="px-8 py-3 text-white font-semibold text-lg shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  border: "none"
                }}
              >
                Completa Registrazione
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
