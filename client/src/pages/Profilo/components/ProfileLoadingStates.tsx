import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ProfileLoadingStatesProps {
  isLoading: boolean;
  isLoadingInfo: boolean;
  error: string | null;
  onRetry: () => void;
}

export const ProfileLoadingStates = ({ 
  isLoading, 
  isLoadingInfo, 
  error, 
  onRetry 
}: ProfileLoadingStatesProps) => {
  // Stato di caricamento
  if (isLoading || isLoadingInfo) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg text-gray-600">Caricamento profilo...</p>
        </div>
      </div>
    );
  }

  // Stato di errore
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-lg shadow-md border border-red-300">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2 text-red-700">Errore nel caricamento</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <Button 
            onClick={onRetry}
            className="bg-red-600 hover:bg-red-700"
          >
            Riprova
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
