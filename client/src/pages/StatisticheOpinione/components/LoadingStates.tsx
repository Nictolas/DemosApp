import React from "react";
import { Loader2 } from "lucide-react";

export const LoadingState: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
};

export const AuthLoadingState: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
};

export const ErrorState: React.FC = () => {
  return (
    <div className="text-center text-red-500 p-4">
      Errore nel caricamento delle statistiche.
    </div>
  );
};

export const UnauthorizedState: React.FC = () => {
  return <div>Non autorizzato</div>;
};
