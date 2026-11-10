import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { OpinioneProposta } from "../types";
import { useOpinioniMutations } from "../hooks";

interface OpinioniProposteProps {
  proposte: OpinioneProposta[];
  isLoading: boolean;
  isError: boolean;
}

export const OpinioniProposte: React.FC<OpinioniProposteProps> = ({ 
  proposte, 
  isLoading, 
  isError 
}) => {
  const { processPropostaMutation } = useOpinioniMutations();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> 
        Caricamento...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-red-500 text-sm">
        Errore nel caricamento delle proposte.
      </div>
    );
  }

  if (!Array.isArray(proposte)) {
    return (
      <div className="text-red-500 text-sm">
        Errore nel caricamento delle proposte.
      </div>
    );
  }

  if (proposte.length === 0) {
    return (
      <div className="text-muted-foreground text-sm">
        Nessuna opinione proposta in attesa.
      </div>
    );
  }

  const ranked = [...proposte].sort((a, b) =>
    (Number(b.voti) || 0) - (Number(a.voti) || 0) || a.testo.localeCompare(b.testo, "it")
  );

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Classifica delle proposte ordinate per voti ricevuti. Una proposta non diventa
        automaticamente un'opinione ufficiale: serve aggiornare il codice e pubblicare una release.
      </p>
      <ol className="space-y-2" aria-label="Classifica delle opinioni proposte">
        {ranked.map((op, index) => (
          <li key={op.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-fuchsia-50/50 px-3 py-3">
            <div className="min-w-0 flex-1">
              <span className="font-medium break-words">{index + 1}. {op.testo}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{Number(op.voti) || 0} voti ricevuti</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Rifiuta proposta: ${op.testo}`}
              onClick={() => {
                if (window.confirm("Rifiutare questa proposta? Verranno rimossi anche i voti collegati.")) {
                  processPropostaMutation.mutate({ id: op.id, action: "rifiuta" });
                }
              }}
              disabled={processPropostaMutation.isPending}
            >
              <X className="mr-1 h-4 w-4" aria-hidden="true" /> Rifiuta
            </Button>
          </li>
        ))}
      </ol>
    </div>
  );
};
