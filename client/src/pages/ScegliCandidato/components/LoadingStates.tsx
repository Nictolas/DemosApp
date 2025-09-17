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
  if (!authReady || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return null;
};
