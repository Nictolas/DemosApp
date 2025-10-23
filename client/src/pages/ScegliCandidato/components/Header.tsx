import React from "react";
import { HeaderProps } from "../types";
import { getTitoloVisuale } from "../utils/candidatoUtils";

export const Header: React.FC<HeaderProps> = ({ categoria, getTitolo }) => {
  return (
    <div className="flex flex-col mb-6">
      <div className="flex items-center mb-2">
        <h1 className="text-2xl font-bold">Scegli Candidato {getTitoloVisuale(categoria)}</h1>
      </div>
    </div>
  );
};
