import React from "react";
import { ElectionsLoadingProps } from "./types";

export function ElectionsLoading({ loading }: ElectionsLoadingProps) {
  if (!loading) {
    return null;
  }

  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <span className="ml-3 text-lg text-gray-600">Caricamento elezioni...</span>
    </div>
  );
}
