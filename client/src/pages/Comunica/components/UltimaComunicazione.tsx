import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UltimaComunicazione } from "../types";

interface UltimaComunicazioneProps {
  ultimaComunicazione: UltimaComunicazione;
}

export const UltimaComunicazioneComponent: React.FC<
  UltimaComunicazioneProps
> = ({ ultimaComunicazione }) => {
  const comunicazione = ultimaComunicazione?.comunicazione;
  if (!comunicazione) return null;

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

  const displayDate = comunicazione.data_votazione || comunicazione.data_creazione;

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Ultimo voto comunicato</CardTitle>
        <CardDescription>La tua ultima rendicontazione istituzionale</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
          <div>
            <span className="font-medium">Votazione:</span>
            <p className="text-sm mt-1">{comunicazione.titolo}</p>
          </div>
          <div>
            <span className="font-medium text-sm">Il tuo voto:</span>
            <Badge
              variant="outline"
              className={`ml-2 ${getVoteBadgeClass(comunicazione.voto_dato)}`}
            >
              {comunicazione.voto_dato}
            </Badge>
          </div>
          {comunicazione.commento && (
            <div>
              <span className="font-medium text-sm">Commento:</span>
              <p className="text-sm mt-1 italic">"{comunicazione.commento}"</p>
            </div>
          )}
          {comunicazione.livello && (
            <div>
              <span className="font-medium text-sm">Livello:</span>
              <p className="text-sm mt-1">{comunicazione.livello}</p>
            </div>
          )}
          <div>
            <span className="font-medium text-sm">Data votazione:</span>
            <p className="text-sm mt-1">
              {new Date(displayDate).toLocaleDateString("it-IT", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
