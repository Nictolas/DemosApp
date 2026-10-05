import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
export default function RegistrazioneConsensiPrivacy() {
  const [, navigate] = useLocation();

  const handleAccetto = () => {
    localStorage.setItem("registrazione_privacy_consent", "true");
    navigate("/registrazione-consensi-termini");
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
          <p className="text-sm text-gray-500 mt-1">1 di 3</p>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Informativa sulla privacy
        </h2>
        <p className="text-gray-600 text-sm mb-6">
          Leggi come trattiamo i tuoi dati personali, i tuoi diritti (accesso, rettifica, cancellazione) 
          e come puoi revocare il consenso. Accettando, dichiari di aver letto e compreso l&apos;informativa.
        </p>
        <Button
          type="button"
          className="w-full h-12 text-lg font-semibold bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md mb-4"
          onClick={handleAccetto}
        >
          Accetto
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full text-sm"
          onClick={() => navigate("/privacy-policy?from=/registrazione-consensi-privacy")}
        >
          Leggi la Privacy Policy
        </Button>

        <div className="text-center mt-6">
          <Button variant="ghost" onClick={() => navigate("/auth")} className="text-gray-500 hover:text-gray-700">
            ← Indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
