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

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">Le proposte possono essere esaminate o rifiutate qui. Per trasformarne una in Opinione ufficiale bisogna aggiornare il catalogo nel codice e pubblicare una release.</p>
      <ul className="space-y-2">
        {proposte.map((op) => (
          <li key={op.id} className="flex items-center justify-between border rounded px-3 py-2 bg-fuchsia-50">
            <div className="flex flex-col">
              <span className="font-medium">{op.testo}</span>
              <span className="text-xs text-muted-foreground">
                Voti: {op.voti}
                {op.proponente && (
                  <> · Proposta da: {op.proponente}</>
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={() => processPropostaMutation.mutate({id: op.id, action: 'rifiuta'})} 
                disabled={processPropostaMutation.isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      
    </div>
  );
};
