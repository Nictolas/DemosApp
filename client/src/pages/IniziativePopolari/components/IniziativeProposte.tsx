import React from "react";
import { IniziativaPopolare } from "../types";
import { Check, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface IniziativeProposteProps {
  iniziativeProposte: IniziativaPopolare[];
  isLoading: boolean;
  isError: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onView?: (iniziativa: IniziativaPopolare) => void;
}

export const IniziativeProposte: React.FC<IniziativeProposteProps> = ({
  iniziativeProposte,
  isLoading,
  isError,
  onApprove,
  onReject,
  onView
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center text-red-500 p-4">
        Errore nel caricamento delle iniziative proposte.
      </div>
    );
  }

  if (iniziativeProposte.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nessuna iniziativa proposta in attesa di approvazione.
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          Iniziative Proposte in Attesa di Approvazione
          <Badge variant="secondary" className="ml-2">
            {iniziativeProposte.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {iniziativeProposte.map((iniziativa) => (
            <div 
              key={iniziativa.id} 
              className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {iniziativa.nome}
                    </h3>
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                      Proposta
                    </Badge>
                  </div>
                  
                  <p className="text-gray-600 mb-3 line-clamp-2">
                    {iniziativa.descrizione}
                  </p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>
                      Data proposta: <strong>
                        {iniziativa.data_creazione || iniziativa.created_at
                          ? new Date(iniziativa.data_creazione || iniziativa.created_at).toLocaleDateString('it-IT')
                          : 'N/A'
                        }
                      </strong>
                    </span>
                    {iniziativa.sitoWeb && (
                      <a 
                        href={iniziativa.sitoWeb} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        Visita sito
                      </a>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  {onView && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onView(iniziativa)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {onApprove && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onApprove(iniziativa.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  {onReject && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onReject(iniziativa.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
