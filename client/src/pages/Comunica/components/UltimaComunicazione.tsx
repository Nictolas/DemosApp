import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UltimaComunicazione } from "../types";

interface UltimaComunicazioneProps {
  ultimaComunicazione: UltimaComunicazione;
}

export const UltimaComunicazioneComponent: React.FC<UltimaComunicazioneProps> = ({ ultimaComunicazione }) => {
  if (!ultimaComunicazione?.comunicazione) {
    return null;
  }

  const getVoteBadgeClass = (vote: string) => {
    switch (vote) {
      case "Favorevole":
        return "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400";
      case "Contrario":
        return "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400";
      default:
        return "border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400";
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Ultima Votazione</CardTitle>
        <CardDescription>
          La tua ultima comunicazione inviata
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
          <div>
            <span className="font-medium">Titolo:</span>
            <p className="text-sm mt-1">{ultimaComunicazione.comunicazione.titolo}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium text-sm">Il tuo voto:</span>
              <Badge 
                variant="outline" 
                className={`ml-2 ${getVoteBadgeClass(ultimaComunicazione.comunicazione.voto_dato)}`}
              >
                {ultimaComunicazione.comunicazione.voto_dato}
              </Badge>
            </div>
            <div>
              <span className="font-medium text-sm">Risultato:</span>
              <Badge 
                variant="outline" 
                className={`ml-2 ${getVoteBadgeClass(ultimaComunicazione.comunicazione.vincitore)}`}
              >
                {ultimaComunicazione.comunicazione.vincitore}
              </Badge>
            </div>
          </div>
          {ultimaComunicazione.comunicazione.commento && (
            <div>
              <span className="font-medium text-sm">Commento:</span>
              <p className="text-sm mt-1 italic">"{ultimaComunicazione.comunicazione.commento}"</p>
            </div>
          )}
          <div>
            <span className="font-medium text-sm">Zona:</span>
            <p className="text-sm mt-1">{ultimaComunicazione.comunicazione.zona}</p>
          </div>
          <div>
            <span className="font-medium text-sm">Data:</span>
            <p className="text-sm mt-1">
              {new Date(ultimaComunicazione.comunicazione.data_creazione).toLocaleDateString('it-IT', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
