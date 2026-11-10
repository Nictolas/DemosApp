import React from "react";
import { Scale } from "lucide-react";

// Testata essenziale: mantiene titolo e tasto + separati dalla classifica scorrevole.
export const Header: React.FC = () => (
  <div className="text-center">
    <div className="flex items-center justify-center gap-2 px-11 sm:px-12">
      <Scale className="h-7 w-7 shrink-0 text-blue-600" aria-hidden="true" />
      <h1 className="min-w-0 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">Grazia</h1>
    </div>
    <p className="mt-1 px-11 text-xs leading-snug text-gray-500 sm:px-12 sm:text-sm">
      <span className="block">La grazia condona o commuta la pena:</span>
      <span className="block">a chi la concederesti?</span>
    </p>
  </div>
);
