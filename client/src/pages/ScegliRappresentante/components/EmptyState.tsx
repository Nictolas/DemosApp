import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyStateProps } from "../types";

export const EmptyState: React.FC<EmptyStateProps> = ({ categoria, getTitolo }) => {
  return (
    <Card className="p-8 text-center">
      <CardContent>
        <h2 className="text-xl font-semibold mb-4">Nessun rappresentante trovato</h2>
        <p className="text-muted-foreground mb-4">
          Non ci sono rappresentanti disponibili per la categoria "{getTitolo()}" nella tua zona.
        </p>
        <Button asChild>
          <Link href="/preferiti">Torna ai Preferiti</Link>
        </Button>
      </CardContent>
    </Card>
  );
};
