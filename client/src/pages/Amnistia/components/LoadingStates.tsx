import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingStatesProps {
  authReady: boolean;
  isLoading: boolean;
  isLoadingData: boolean;
}

export const LoadingStates: React.FC<LoadingStatesProps> = ({ 
  authReady, 
  isLoading, 
  isLoadingData 
}) => {
  if (!authReady || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return null;
};
