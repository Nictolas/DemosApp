import React from "react";
import { Button } from "@/components/ui/button";
import { ProfileErrorProps } from "./types";

export function ProfileError({ error, onRetry }: ProfileErrorProps) {
  if (!error) {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="text-center max-w-md mx-auto p-8 bg-white rounded-lg shadow-md border border-red-300">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold mb-2 text-red-700">Errore nel caricamento</h2>
        <p className="text-gray-700 mb-4">{error}</p>
        <Button 
          onClick={onRetry}
          className="bg-red-600 hover:bg-red-700"
        >
          Riprova
        </Button>
      </div>
    </div>
  );
}
