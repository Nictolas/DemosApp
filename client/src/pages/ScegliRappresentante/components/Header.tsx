import React from "react";
import { useLocation } from "wouter";
import { HeaderProps } from "../types";

export const Header: React.FC<HeaderProps> = ({ categoria }) => {
  const [location] = useLocation();
  const isCandidateRoute = location === "/candidati" || location.startsWith("/candidati/");

  const getTitoloPagina = (value: string) => {
    switch (value) {
      case "europeo": return "Europeo";
      case "camera": return "Camera";
      case "senato": return "Senato";
      case "regione": return "Regione";
      case "comune": return "Comune";
      default: return "";
    }
  };

  const entityLabel = isCandidateRoute ? "Candidato" : "Rappresentante";

  return (
    <div className="flex flex-col mb-6">
      <div className="flex items-center mb-2">
        <h1 className="text-2xl font-bold">
          Scegli {entityLabel} {getTitoloPagina(categoria)}
        </h1>
      </div>
    </div>
  );
};
