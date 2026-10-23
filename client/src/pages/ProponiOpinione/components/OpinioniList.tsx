import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, Info, ThumbsDown, Trash2 } from "lucide-react";
import { OpinioniListProps } from "../types";
import { getVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const OpinioniList: React.FC<OpinioniListProps> = ({
  opinioni,
  userVoti,
  isVoting,
  votiVerificati,
  votiError,
  onRiprova,
  onVota,
  onRimuoviVoto,
  onCancella,
  isAdmin = false
}) => {
  const currentVotes = userVoti.length;
  const limit = getVotingLimit('opinioni_proposte');
  const remainingVotes = getRemainingVotes('opinioni_proposte', currentVotes);
  const hasReachedLimit = !votiVerificati || remainingVotes === 0;

  if (opinioni.length === 0) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ThumbsUp className="h-5 w-5" />
            <span>Opinioni proposte</span>
          </CardTitle>
          <CardDescription>
            Vota l'opinione che vorresti vedere aggiunta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Nessuna opinione proposta al momento.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ThumbsUp className="h-5 w-5" />
            <span className="text-lg font-semibold">Opinioni proposte</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={hasReachedLimit ? "destructive" : "secondary"} className="flex items-center space-x-1">
              <Info className="h-3 w-3" />
              <span>{votiVerificati ? currentVotes : "—"}/{limit}</span>
            </Badge>
          </div>
        </div>
        <CardDescription>
          Vota l'opinione che vorresti vedere aggiunta.
        </CardDescription>
        {votiError && (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-red-50 p-3 text-sm text-red-800">
            <span>{votiError}</span>
            <Button type="button" variant="outline" size="sm" onClick={onRiprova} disabled={isVoting}>Riprova</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {opinioni.map(op => (
            <li key={op.id} className="flex items-center justify-between border-b pb-2">
              <div>
                <span className="font-medium">{op.testo}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-fuchsia-700 font-bold">{op.voti}</span>
                {userVoti.includes(op.id) ? (
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    disabled={isVoting || !votiVerificati} 
                    onClick={() => onRimuoviVoto(op.id)}
                  >
                    <ThumbsDown className="h-4 w-4 mr-1" /> 
                    Rimuovi
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    disabled={isVoting || hasReachedLimit} 
                    onClick={() => onVota(op.id)}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" /> 
                    Vota
                  </Button>
                )}
                {isAdmin && onCancella && (
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    disabled={isVoting} 
                    onClick={() => {
                      if (confirm('Sei sicuro di voler cancellare questa opinione?')) {
                        onCancella(op.id);
                      }
                    }}
                    title="Cancella opinione (solo admin)"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
