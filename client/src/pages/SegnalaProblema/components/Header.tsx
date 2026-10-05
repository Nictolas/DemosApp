import React from "react";
import { AlertTriangle } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <div className="mb-8">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-xl bg-linear-to-br from-orange-500 to-yellow-600 flex items-center justify-center shadow-lg">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent">
            Segnala Problema
          </h1>
        </div>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Aiutaci a migliorare la piattaforma segnalando bug, malfunzionamenti o suggerendo nuove funzionalità.
        </p>
      </div>
    </div>
  );
};
