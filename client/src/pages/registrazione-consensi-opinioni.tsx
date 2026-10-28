import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
export default function RegistrazioneConsensiOpinioni() {
  const [, navigate] = useLocation();

  const handleAccetto = () => {
    localStorage.setItem("registrazione_political_opinions_consent", "true");
    localStorage.setItem("registrazione_passkey_flow", "1");
    navigate("/registrazione-cittadinanza");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
          <p className="text-sm text-gray-500 mt-1">3 di 3</p>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Consenso opinioni politiche
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          <strong>Consento esplicitamente</strong> al trattamento delle mie opinioni politiche (GDPR Art. 9). 
          Questo consenso è necessario per esprimere opinioni e votare sulla piattaforma. 
          Puoi revocarlo in qualsiasi momento dalle impostazioni; in quel caso alcune funzionalità saranno limitate.
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
          onClick={() => navigate("/privacy-policy?from=/registrazione-consensi-opinioni#4.1")}
        >
          Maggiori informazioni
        </Button>

        <div className="text-center mt-6">
          <Button variant="ghost" onClick={() => navigate("/registrazione-consensi-termini")} className="text-gray-500 hover:text-gray-700">
            ← Indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
