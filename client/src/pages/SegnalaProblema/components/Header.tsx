import React from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export const Header: React.FC = () => {
  const [, setLocation] = useLocation();

  return (
    <div className="mb-8">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/impostazioni")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg px-3 py-2 transition-all duration-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna alle Impostazioni
        </Button>
      </div>

      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-600 flex items-center justify-center shadow-lg">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent">
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
