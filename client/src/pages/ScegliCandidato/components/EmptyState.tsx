import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface EmptyStateProps {
  categoria: string;
  getTitolo: () => string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ categoria, getTitolo }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Nessun candidato disponibile</CardTitle>
        <CardDescription className="text-center">
          Non ci sono candidati per {getTitolo().toLowerCase()} nella tua zona.
        </CardDescription>
      </CardHeader>
    </Card>
  );
};
