import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function RegistrazioneDataNascita() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 android-fixed-registration">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 android-fixed-registration__panel">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Passaggio non più necessario
          </h2>
          <p className="text-gray-600 text-sm mb-2">
            Non raccogliamo più l&apos;anno di nascita nella fase di registrazione. Puoi continuare con i prossimi passaggi.
          </p>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <Button
            type="button"
            className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
            onClick={() => navigate("/registrazione-3-residenza")}
          >
            Continua
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/registrazione-cittadinanza")}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
