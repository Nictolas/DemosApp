import React from "react";
import { IniziativaPopolare } from "../types";
import { Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getDisplayableDate } from "@/utils/dateUtils";

interface MiaIniziativaPropostaProps {
  iniziativa: IniziativaPopolare;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

export const MiaIniziativaProposta: React.FC<MiaIniziativaPropostaProps> = ({
  iniziativa,
  onDelete,
  isDeleting = false
}) => {
  const dataInizio = getDisplayableDate(iniziativa.dataInizio || iniziativa.data_inizio);
  const dataFine = getDisplayableDate(iniziativa.dataFine || iniziativa.data_fine);

  return (
    <Card className="w-full border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            La Tua Iniziativa Proposta
            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
              In Attesa di Approvazione
            </Badge>
          </div>
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(iniziativa.id)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Eliminazione...' : 'Elimina'}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Non puoi proporre altre iniziative</strong> finché questa non è stata approvata dallo staff. 
            Puoi eliminare questa proposta per proporne una nuova.
          </AlertDescription>
        </Alert>

        <div className="bg-white rounded-lg p-4 border border-orange-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {iniziativa.nome}
          </h3>
          
          <p className="text-gray-600 mb-3">
            {iniziativa.descrizione}
          </p>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            {dataInizio ? (
              <span>
                Data inizio: <strong>
                  {new Date(dataInizio).toLocaleDateString('it-IT')}
                </strong>
              </span>
            ) : null}
            
            {dataFine ? (
              <span>
                Data fine: <strong>
                  {new Date(dataFine).toLocaleDateString('it-IT')}
                </strong>
              </span>
            ) : null}
            
            {(iniziativa.data_creazione || iniziativa.created_at) ? (
              <span>
                Proposta il: <strong>
                  {new Date(iniziativa.data_creazione || iniziativa.created_at).toLocaleDateString('it-IT')}
                </strong>
              </span>
            ) : null}
            
            {iniziativa.sitoWeb && (
              <a 
                href={iniziativa.sitoWeb} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Visita sito web
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
