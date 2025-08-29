import React from "react";
import { Vote } from "lucide-react";
import { ElectionsEmptyProps } from "./types";

export function ElectionsEmpty({ elezioni }: ElectionsEmptyProps) {
  if (elezioni.length > 0) {
    return null;
  }

  return (
    <div className="text-center py-12">
      <Vote className="h-16 w-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna elezione trovata</h3>
      <p className="text-gray-500">Crea la tua prima elezione per iniziare</p>
    </div>
  );
}
