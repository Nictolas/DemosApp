import React from "react";
import { HeaderProps } from "../types";

export const Header: React.FC<HeaderProps> = ({ categoria, getTitolo }) => {
  // Mappa semplice per i titoli
  const getTitoloPagina = (categoria: string) => {
    switch (categoria) {
      case "europeo": return "Europeo";
      case "camera": return "Camera";
      case "senato": return "Senato";
      case "regione": return "Regione";
      case "comune": return "Comune";
      default: return "Candidato";
    }
  };

  return (
    <div className="flex flex-col mb-6">
      <div className="flex items-center mb-2">
        <h1 className="text-2xl font-bold">Scegli Candidato {getTitoloPagina(categoria)}</h1>
      </div>
    </div>
  );
};
