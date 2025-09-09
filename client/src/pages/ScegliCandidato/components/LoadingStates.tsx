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
      <div className="flex items-center justify-center pt-16">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  return null;
};