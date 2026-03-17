import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export const ErrorState: React.FC = () => {
  return (
    <Card className="p-8 text-center">
      <CardContent>
        <h2 className="text-xl font-semibold text-red-600">Errore nel caricamento</h2>
        <p>Impossibile caricare i tuoi candidati.</p>
      </CardContent>
    </Card>
  );
};
