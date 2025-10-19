import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function RegistrazioneGenere() {
  const [, navigate] = useLocation();

  const handleGenereSelect = (genere: string) => {
    localStorage.setItem("registrazione_genere", genere);
    navigate("/registrazione-cittadinanza");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
          
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            In cosa ti identifichi?
          </h2>
          <p className="text-gray-600 text-sm">
            Scegli l'opzione che meglio rappresenta la tua identità
          </p>
        </div>

        <div className="space-y-4">
          {/* Opzione Maschile */}
          <Button
            onClick={() => handleGenereSelect("u")}
            variant="outline"
            className="w-full h-20 text-lg font-medium border-2 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
          >
            <div className="flex items-center justify-center space-x-3">
              <span className="text-3xl text-blue-600">♂</span>
              <span className="text-gray-800">Uomo</span>
            </div>
          </Button>

          {/* Opzione Femminile */}
          <Button
            onClick={() => handleGenereSelect("d")}
            variant="outline"
            className="w-full h-20 text-lg font-medium border-2 hover:border-pink-500 hover:bg-pink-50 transition-all duration-200"
          >
            <div className="flex items-center justify-center space-x-3">
              <span className="text-3xl text-pink-600">♀</span>
              <span className="text-gray-800">Donna</span>
            </div>
          </Button>

          {/* Opzione Non Binario */}
          <Button
            onClick={() => handleGenereSelect("a")}
            variant="outline"
            className="w-full h-20 text-lg font-medium border-2 hover:border-yellow-500 hover:bg-yellow-50 transition-all duration-200"
          >
            <div className="flex items-center justify-center space-x-3">
              <span className="text-3xl text-yellow-600">⚧</span>
              <span className="text-gray-800">Non binario / Altro</span>
            </div>
          </Button>
        </div>

        <div className="text-center mt-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/registrazione-nome")}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
