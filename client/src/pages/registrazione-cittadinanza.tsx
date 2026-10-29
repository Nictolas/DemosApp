import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function RegistrazioneCittadinanza() {
  const [, navigate] = useLocation();

  const handleCittadinanzaSelect = (cittadinanza: string) => {
    localStorage.setItem("registrazione_cittadinanza", cittadinanza);
    navigate("/registrazione-data-nascita");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 android-fixed-registration">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 android-fixed-registration__panel">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
          
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Di quale nazionalità sei?
          </h2>
          <p className="text-gray-600 text-sm">
            Scegli la tua cittadinanza principale
          </p>
        </div>

        <div className="space-y-4">
          {/* Cittadinanza Italiana */}
          <Button
            onClick={() => handleCittadinanzaSelect("it")}
            variant="outline"
            className="w-full h-16 text-lg font-medium border-2 hover:border-green-500 hover:bg-green-50 transition-all duration-200"
          >
            <div className="flex items-center justify-center space-x-3">
              <span className="text-2xl">🇮🇹</span>
              <span className="text-gray-800">Italiana</span>
            </div>
          </Button>

          {/* Cittadinanza Europea */}
          <Button
            onClick={() => handleCittadinanzaSelect("st")}
            variant="outline"
            className="w-full h-16 text-lg font-medium border-2 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
          >
            <div className="flex items-center justify-center space-x-3">
              <span className="text-2xl">🇪🇺</span>
              <span className="text-gray-800">Europea (UE)</span>
            </div>
          </Button>

          {/* Cittadinanza Extra-UE */}
          <Button
            onClick={() => handleCittadinanzaSelect("st")}
            variant="outline"
            className="w-full h-16 text-lg font-medium border-2 hover:border-purple-500 hover:bg-purple-50 transition-all duration-200"
          >
            <div className="flex items-center justify-center space-x-3">
              <span className="text-2xl">🌍</span>
              <span className="text-gray-800">Extra-UE</span>
            </div>
          </Button>
        </div>

        <div className="text-center mt-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/registrazione-genere")}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
