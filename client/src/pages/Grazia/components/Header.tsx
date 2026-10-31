import React from "react";
import { Scale } from "lucide-react";

// Intestazione centrata come Attivisti/Organizzazioni, sempre fuori dalla lista scorrevole.
export const Header: React.FC = () => (
  <div className="text-center">
    <div className="mb-2 flex items-center justify-center gap-2 px-10 sm:px-12">
      <Scale className="h-8 w-8 shrink-0 text-blue-600" aria-hidden="true" />
      <h1 className="min-w-0 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">Grazia</h1>
    </div>
    <p className="text-sm text-gray-600 sm:text-base">
      Vota per chiedere la grazia a favore di una persona.
    </p>
  </div>
);
