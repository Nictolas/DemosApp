import React from "react";
import { useParams } from "wouter";
import ScegliCandidatoPage from "./ScegliCandidato";

export default function ScegliCandidato() {
  const { categoria } = useParams<{ categoria: string }>();
  
  // Reindirizza alla nuova struttura
  return <ScegliCandidatoPage />;
}