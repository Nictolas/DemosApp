import React from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
          <AlertDialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Opinioni Incomplete
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-base text-gray-700 mt-2">
            <p>
              Per accedere a questa sezione, completa prima tutte le opinioni disponibili.
            </p>
            
            <p className="text-sm text-gray-600">
              💡 Completando tutte le opinioni otterrai risultati più precisi e affidabili!
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <AlertDialogCancel onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Chiudi
          </AlertDialogCancel>
          <AlertDialogAction onClick={onGoToOpinions} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            <ArrowRight className="h-4 w-4 mr-2" />
            Vai alle Opinioni
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
