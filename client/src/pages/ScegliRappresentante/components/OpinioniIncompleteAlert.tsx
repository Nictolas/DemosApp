import React from "react";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle, ArrowRight } from "lucide-react";

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
  console.log('🔍 DEBUG OpinioniIncompleteAlert - open:', open);
  console.log('🔍 DEBUG OpinioniIncompleteAlert - data:', data);
  
  // Ora data dovrebbe sempre essere disponibile dato che il componente viene renderizzato solo quando showOpinioniAlert && opinioniAlertData
  if (!data) {
    console.log('🔍 DEBUG OpinioniIncompleteAlert - data è null, questo non dovrebbe succedere!');
    return null;
  }

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
              Per accedere a questa sezione, completa prima tutte le opinioni disponibili.
            </p>
            
            <p className="text-sm text-gray-600">
              💡 Completando tutte le opinioni otterrai risultati più precisi e affidabili!
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogAction onClick={onGoToOpinions} className="w-full sm:w-auto">
            <ArrowRight className="h-4 w-4 mr-2" />
            Vai alle Opinion
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
