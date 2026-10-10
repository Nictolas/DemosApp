import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User } from "lucide-react";

// Definiamo i tipi per le props che il componente riceverà
interface OpinionQuestion {
  id: string;
  text: string;
}

interface ProfileOpinionsProps {
  userOpinions: Record<string, string>;
  opinionQuestions: OpinionQuestion[];
}

// Esportiamo il componente
export function ProfileOpinions({ userOpinions, opinionQuestions }: ProfileOpinionsProps) {

  // Se non ci sono domande di opinione, non ha senso mostrare il componente.
  if (opinionQuestions.length === 0) {
    return null;
  }

  // Questa funzione è la logica che abbiamo spostato dal file originale.
  // Suddivide le opinioni nelle tre categorie.
  const categorizeAllOpinions = () => {
    const favorevoli: { id: string, label: string }[] = [];
    const indecisi: { id: string, label: string }[] = [];
    const contrari: { id: string, label: string }[] = [];

    // Iteriamo solo sulle opinioni che l'utente ha effettivamente espresso.
    for (const [key, value] of Object.entries(userOpinions)) {
      if (!value) continue; // Salta se il valore è vuoto o nullo

      // Troviamo il testo completo della domanda usando l'ID (la chiave)
      const question = opinionQuestions.find(q => q.id === key);
      const label = question ? question.text : key; // Usa l'ID come fallback se non trova il testo

      if (value === "Favorevole") {
        favorevoli.push({ id: key, label });
      } else if (value === "Indeciso" || value === "Non lo so") {
        indecisi.push({ id: key, label });
      } else if (value === "Contrario") {
        contrari.push({ id: key, label });
      }
    }
    return { favorevoli, indecisi, contrari };
  };

  const { favorevoli, indecisi, contrari } = categorizeAllOpinions();

  return (
    <Card className="animate-in-delay">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Le Tue Opinioni Politiche
        </CardTitle>
        <CardDescription>
          Visualizzazione delle tue posizioni sui temi principali
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Colonna Favorevoli */}
          <div className="space-y-3">
            <div className="bg-green-100 border border-green-200 rounded-lg p-4 h-full">
              <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                Favorevole
              </h3>
              <div className="space-y-2">
                {favorevoli.length > 0 ? (
                  favorevoli.map(({ id, label }) => (
                    <div key={id} className="bg-green-50 border border-green-200 rounded-md p-3">
                      <span className="text-green-800 font-medium">{label}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-green-600 text-sm italic">
                    Nessuna opinione favorevole
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Colonna Non lo so */}
          <div className="space-y-3">
            <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-4 h-full">
              <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                Non lo so
              </h3>
              <div className="space-y-2">
                {indecisi.length > 0 ? (
                  indecisi.map(({ id, label }) => (
                    <div key={id} className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <span className="text-yellow-800 font-medium">{label}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-yellow-600 text-sm italic">
                    Nessuna risposta “Non lo so”
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Colonna Contrari */}
          <div className="space-y-3">
            <div className="bg-red-100 border border-red-200 rounded-lg p-4 h-full">
              <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                Contrario
              </h3>
              <div className="space-y-2">
                {contrari.length > 0 ? (
                  contrari.map(({ id, label }) => (
                    <div key={id} className="bg-red-50 border border-red-200 rounded-md p-3">
                      <span className="text-red-800 font-medium">{label}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-red-600 text-sm italic">
                    Nessuna opinione contraria
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
