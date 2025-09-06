import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingStatesProps {
  authReady: boolean;
  isLoading: boolean;
  loading: boolean;
}

export const LoadingStates: React.FC<LoadingStatesProps> = ({ 
  authReady, 
  isLoading, 
  loading 
}) => {
  if (!authReady || isLoading || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }
  
  return null;
};
