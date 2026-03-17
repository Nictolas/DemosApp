import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
export default function RegistrazioneConsensiTermini() {
  const [, navigate] = useLocation();

  const handleAccetto = () => {
    localStorage.setItem("registrazione_terms_consent", "true");
    navigate("/registrazione-consensi-opinioni");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
          <p className="text-sm text-gray-500 mt-1">2 di 3</p>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Termini di servizio
        </h2>
        <p className="text-gray-600 text-sm mb-6">
          Leggi le condizioni d&apos;uso della piattaforma Demos: regole, responsabilità e 
          utilizzo del servizio. Accettando, dichiari di aver letto e di accettare i termini.
        </p>
        <Button
          type="button"
          className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md mb-4"
          onClick={handleAccetto}
        >
          Accetto
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full text-sm"
          onClick={() => navigate("/terms-of-service?from=/registrazione-consensi-termini")}
        >
          Leggi i Termini di Servizio
        </Button>

        <div className="text-center mt-6">
          <Button variant="ghost" onClick={() => navigate("/registrazione-consensi-privacy")} className="text-gray-500 hover:text-gray-700">
            ← Indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
