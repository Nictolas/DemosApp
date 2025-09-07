import React from "react";
import { Plus, X, Save, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VotingFormProps } from "../types";

export const VotingForm: React.FC<VotingFormProps> = ({
  votingState,
  data,
  onUpdateField,
  onAddNome,
  onRemove,
  onShowForm,
  onSaveVoti
}) => {
  const isBlocked = data?.blocco.isBlocked || false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          I Tuoi Voti
          {votingState.selectedVoti.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {votingState.selectedVoti.length} selezionati
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form per aggiungere candidati */}
        <form onSubmit={onAddNome} className="flex gap-2">
          <Input
            placeholder="Inserisci il nome del candidato..."
            value={votingState.nomeInput}
            onChange={(e) => onUpdateField('nomeInput', e.target.value)}
            disabled={isBlocked}
            className="flex-1"
          />
          <Button type="submit" disabled={isBlocked || !votingState.nomeInput.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        {/* Lista candidati selezionati */}
        {votingState.selectedVoti.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Candidati selezionati:</h4>
            <div className="space-y-2">
              {votingState.selectedVoti.map((nome) => (
                <div
                  key={nome}
                  className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg"
                >
                  <span className="font-medium">{nome}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(nome)}
                    disabled={isBlocked}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pulsante salva */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={onSaveVoti}
            disabled={isBlocked || votingState.selectedVoti.length === 0}
            className="min-w-[120px]"
          >
            <Save className="h-4 w-4 mr-2" />
            Salva Voti
          </Button>
        </div>

        {/* Messaggio di blocco */}
        {isBlocked && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Voti bloccati:</strong> Puoi modificare i voti solo una volta a settimana.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
