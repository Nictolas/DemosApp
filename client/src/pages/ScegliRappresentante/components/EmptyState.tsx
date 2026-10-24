import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyStateProps } from "../types";

export const EmptyState: React.FC<EmptyStateProps> = ({ isCandidate }) => {
  return (
    <Card className="mx-auto w-full max-w-2xl text-center">
      <CardContent className="flex flex-col items-center px-5 py-8 sm:px-8">
        <h2 className="text-xl font-semibold mb-4">
          {isCandidate ? "Nessun candidato disponibile" : "Nessun rappresentante disponibile"}
        </h2>
        <p className="text-muted-foreground mb-6 max-w-xl">
          {isCandidate
            ? "Al momento non c'è una data per queste elezioni o non ci sono candidati disponibili."
            : "Al momento non ci sono rappresentanti disponibili per questa selezione."}
        </p>
        <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
          {isCandidate && (
            <Button asChild>
              <Link href="/riconoscimento">Clicca qui se sei un Candidato</Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/preferiti">Torna ai Preferiti</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
