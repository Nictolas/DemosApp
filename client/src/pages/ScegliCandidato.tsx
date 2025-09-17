import React from "react";
import { useParams } from "wouter";
import ScegliCandidatoPage from "./ScegliCandidato";

export default function ScegliCandidato() {
  const { categoria } = useParams<{ categoria: string }>();
  
  // Passa il parametro categoria alla nuova struttura
  return <ScegliCandidatoPage categoria={categoria} />;
}
