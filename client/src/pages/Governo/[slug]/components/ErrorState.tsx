import React from "react";
import { AlertCircle } from "lucide-react";

export const ErrorState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold text-destructive mb-2">Errore nel caricamento</h3>
      <p className="text-muted-foreground text-center">
        Si è verificato un errore nel caricamento dei dati del ministero.
      </p>
    </div>
  );
};
