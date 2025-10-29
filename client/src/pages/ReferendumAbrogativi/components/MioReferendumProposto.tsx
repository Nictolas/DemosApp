import React from "react";
import { Referendum } from "../types";
import { Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MioReferendumPropostoProps {
  referendum: Referendum;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

export const MioReferendumProposto: React.FC<MioReferendumPropostoProps> = ({
  referendum,
  onDelete,
  isDeleting = false
}) => {
  return (
    <Card className="w-full border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            Il Tuo Referendum Proposto
            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
              In Attesa di Approvazione
            </Badge>
          </div>
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(referendum.id)}
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
            <strong>Non puoi proporre altri referendum</strong> finché questo non è stato approvato dallo staff. 
            Puoi eliminare questa proposta per proporne una nuova.
          </AlertDescription>
        </Alert>

        <div className="bg-white rounded-lg p-4 border border-orange-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {referendum.nome}
          </h3>
          
          <p className="text-gray-600 mb-3">
            {referendum.descrizione}
          </p>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            {referendum.dataInizio || referendum.data_inizio ? (
              <span>
                Data inizio: <strong>
                  {new Date(referendum.dataInizio || referendum.data_inizio).toLocaleDateString('it-IT')}
                </strong>
              </span>
            ) : null}
            
            {referendum.dataFine || referendum.data_fine ? (
              <span>
                Data fine: <strong>
                  {new Date(referendum.dataFine || referendum.data_fine).toLocaleDateString('it-IT')}
                </strong>
              </span>
            ) : null}
            
            {referendum.created_at ? (
              <span>
                Proposto il: <strong>
                  {new Date(referendum.created_at).toLocaleDateString('it-IT')}
                </strong>
              </span>
            ) : null}
            
            {referendum.sitoWeb && (
              <a 
                href={referendum.sitoWeb} 
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

