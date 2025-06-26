import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AnalisiConsumi() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => window.location.href = "/gestisci"}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna a Gestisci
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Analisi Consumi e Limiti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-1">1. Banda (100 GB/mese)</h3>
              <p>
                Il consumo di banda dipende dal peso degli asset (JS, CSS, immagini) e dal numero di sessioni utente. Se ogni utente effettua 1-2 sessioni complete al mese, il traffico totale resta sotto i 100 GB. Se gli utenti accedono più spesso, si rischia di superare il limite. Ottimizza asset e usa cache/CDN per restare nei limiti.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">2. Serverless GB-hr (100 GB-hr/mese)</h3>
              <p>
                Le funzioni serverless (API) consumano pochissimo: anche con 1.000.000 di chiamate al mese, resti molto sotto il limite. Nessun rischio di sforamento con l&apos;architettura attuale.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">3. Edge Invocazioni (500.000/mese)</h3>
              <p>
                Ogni operazione che richiede una funzione Edge conta come una invocazione. Se ogni utente effettua 2 sessioni al mese con 2 chiamate Edge, resti sotto il limite. Se la frequenza o le chiamate aumentano, puoi superare il tetto. Usa Edge solo dove necessario.
              </p>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              <b>Nota:</b> Queste stime sono indicative e vanno monitorate con dati reali di traffico e utilizzo.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 