import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export const ErrorState: React.FC = () => {
  return (
    <Card className="bg-white shadow-lg border-red-200">
      <CardContent className="p-8 text-center">
        <div className="text-red-500 text-xl mb-2">⚠️</div>
        <p className="text-red-600 font-medium">Errore nel caricamento delle statistiche.</p>
        <p className="text-gray-500 mt-2">Riprova più tardi o contatta l'amministratore.</p>
      </CardContent>
    </Card>
  );
};
