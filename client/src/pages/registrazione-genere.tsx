import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function RegistrazioneGenere() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Passaggio non più necessario
          </h2>
          <p className="text-gray-600 text-sm">
            Non raccogliamo più il genere nella fase di registrazione. Puoi continuare con i prossimi passaggi.
          </p>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <Button
            onClick={() => navigate("/registrazione-cittadinanza")}
            className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
          >
            Continua
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              navigate(
                typeof window !== "undefined" && window.localStorage.getItem("registrazione_passkey_flow")
                  ? "/registrazione-consensi"
                  : window.localStorage.getItem("webauthn_user_id")
                  ? "/auth"
                  : "/auth"
              )
            }
            className="text-gray-500 hover:text-gray-700"
          >
            ← Indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
