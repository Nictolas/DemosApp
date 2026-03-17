import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { LastCommunicationProps } from "./types";
import { getVoteBadgeVariant } from "./utils";

export function LastCommunication({ communication }: LastCommunicationProps) {
  if (!communication?.comunicazione) {
    return null;
  }

  const { comunicazione } = communication;

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
            <p className="text-sm mt-1">{comunicazione.titolo}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium text-sm">Il tuo voto:</span>
              <Badge 
                variant="outline" 
                className={`ml-2 ${getVoteBadgeVariant(comunicazione.voto_dato)}`}
              >
                {comunicazione.voto_dato}
              </Badge>
            </div>
            <div>
              <span className="font-medium text-sm">Risultato:</span>
              <Badge 
                variant="outline" 
                className={`ml-2 ${getVoteBadgeVariant(comunicazione.vincitore)}`}
              >
                {comunicazione.vincitore}
              </Badge>
            </div>
          </div>
          {comunicazione.commento && (
            <div>
              <span className="font-medium text-sm">Commento:</span>
              <p className="text-sm mt-1 italic">"{comunicazione.commento}"</p>
            </div>
          )}
          <div>
            <span className="font-medium text-sm">Zona:</span>
            <p className="text-sm mt-1">{comunicazione.zona}</p>
          </div>
          <div>
            <span className="font-medium text-sm">Data:</span>
            <p className="text-sm mt-1">
              {new Date(comunicazione.data_creazione).toLocaleDateString('it-IT', {
                timeZone: 'Europe/Rome',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="font-medium text-sm">Feedback ricevuto:</span>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <ThumbsUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">{comunicazione.likes || 0}</span>
              </div>
              <div className="flex items-center space-x-1">
                <ThumbsDown className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">{comunicazione.dislikes || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
