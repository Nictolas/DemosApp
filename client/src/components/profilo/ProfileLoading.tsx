import React from "react";
import { Loader2 } from "lucide-react";
import { ProfileLoadingProps } from "./types";

export function ProfileLoading({ isLoading, isLoadingInfo }: ProfileLoadingProps) {
  if (!isLoading && !isLoadingInfo) {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-lg text-gray-600">Caricamento profilo...</p>
      </div>
    </div>
  );
}
