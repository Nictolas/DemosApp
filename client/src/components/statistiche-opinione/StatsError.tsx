import React from "react";
import { StatsErrorProps } from "./types";

export function StatsError({ isError }: StatsErrorProps) {
  if (!isError) {
    return null;
  }

  return (
    <div className="text-center text-red-500 p-4">
      Errore nel caricamento delle statistiche.
    </div>
  );
}
