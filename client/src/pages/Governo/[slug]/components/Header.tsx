import React from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderProps } from "../types";

export const Header: React.FC<HeaderProps> = ({ ministero, unlockDate }) => {
  const [, setLocation] = useLocation();
  const IconComponent = ministero.icon;

  const handleBack = () => {
    setLocation("/governo");
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-4 mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={handleBack}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconComponent className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{ministero.nome}</h1>
            <p className="text-muted-foreground">Vota per il tuo candidato preferito</p>
          </div>
        </div>
      </div>
      
      {unlockDate && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <strong>Blocco attivo:</strong> Puoi modificare i voti solo una volta a settimana. 
            Prossimo sblocco: {new Date(unlockDate).toLocaleString('it-IT')}
          </p>
        </div>
      )}
    </div>
  );
};
