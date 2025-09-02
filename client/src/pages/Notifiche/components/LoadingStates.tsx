import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingStatesProps {
  isAuthLoading: boolean;
}

export const LoadingStates: React.FC<LoadingStatesProps> = ({ isAuthLoading }) => {
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return null;
};
