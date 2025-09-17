import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, X, Scale } from "lucide-react";

interface GraziaFormProps {
  nomeInput: string;
  selectedVoti: string[];
  isBlocked: boolean;
  isPending: boolean;
  onUpdateField: (field: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onRemoveLocal: (nome: string) => void;
}

export const GraziaForm: React.FC<GraziaFormProps> = ({
  nomeInput,
  selectedVoti,
  isBlocked,
  isPending,
  onUpdateField,
  onSubmit,
  onRemoveLocal
}) => {
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Scale className="h-5 w-5" />
          <span>La tua richiesta di grazia</span>
        </CardTitle>
        <CardDescription>
          Inserisci il nome del carcerato per cui vuoi chiedere la grazia.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex space-x-2">
            <Input 
              placeholder="Nome del carcerato..." 
              value={nomeInput} 
              onChange={(e) => onUpdateField('nomeInput', e.target.value)} 
              disabled={isBlocked}
            />
            <Button 
              type="submit" 
              disabled={isPending || !nomeInput.trim() || isBlocked}
            >
              <Plus className="h-4 w-4 mr-2" />
              Chiedi Grazia
            </Button>
          </div>
        </form>

        {selectedVoti.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Le tue richieste selezionate:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedVoti.map((voto) => (
                <Badge 
                  key={voto} 
                  variant="default" 
                  className="cursor-pointer hover:bg-destructive/90" 
                  onClick={() => onRemoveLocal(voto)}
                >
                  <X className="h-3 w-3 mr-1" />
                  {voto}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
