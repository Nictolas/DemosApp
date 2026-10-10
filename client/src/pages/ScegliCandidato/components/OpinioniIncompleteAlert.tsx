import React from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";

interface OpinioniIncompleteAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    grado: string;
    totaleOpinioni: number;
    opinioniRisposte: number;
    opinioniMancanti: number;
    percentualeCompletamento: number;
    isComplete: boolean;
    missingOpinions: Array<{
      id: string;
      text: string;
    }>;
  } | null;
  onGoToOpinions: () => void;
}

export const OpinioniIncompleteAlert: React.FC<OpinioniIncompleteAlertProps> = ({
  open,
  onOpenChange,
  data,
  onGoToOpinions
}) => {
  if (!data) return null;

  const gradoLabels: Record<string, string> = {
    'N': 'Nazionali',
    'E': 'Europee',
    'R': 'Regionali',
    'C': 'Comunali',
    'CO': 'Comunali'  // Aggiunto per gestire grado CO
  };

  const gradoLabel = gradoLabels[data.grado] || data.grado;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <AlertDialogTitle>Opinioni Incomplete</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <p>
              Per trovare i candidati più compatibili per le opinioni <strong>{gradoLabel}</strong>, 
              completa prima tutte le opinioni di questo grado.
            </p>
            
            <div className="bg-gray-50 p-3 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Completamento:</span>
                <Badge variant={data.percentualeCompletamento >= 80 ? "default" : "secondary"}>
                  {data.percentualeCompletamento}%
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{data.opinioniRisposte} di {data.totaleOpinioni} opinioni completate</span>
              </div>
              
              {data.opinioniMancanti > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{data.opinioniMancanti} opinioni mancanti</span>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-600">
              💡 Completando tutte le opinioni otterrai risultati più precisi e affidabili!
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="w-full sm:w-auto">
            Chiudi
          </AlertDialogCancel>
          <AlertDialogAction onClick={onGoToOpinions} className="w-full sm:w-auto">
            <ArrowRight className="h-4 w-4 mr-2" />
            Vai alle Opinion
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
