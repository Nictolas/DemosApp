import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";
import { ViewProgrammaDialog } from "@/components/ViewProgrammaDialog";
import { useElezioniData } from "../Elezioni/hooks/useElezioniData";
import { useElezioniActions } from "../Elezioni/hooks/useElezioniActions";
import { CategoriaPrincipale } from "../Elezioni/components/CategoriaPrincipale";
import { CandidatoCard } from "../Elezioni/components/CandidatoCard";
import { LoadingState } from "../Elezioni/components/LoadingState";
import { ErrorState } from "../Elezioni/components/ErrorState";
import { categorie, colorMap } from "../Elezioni/constants/categorie";

export default function Candidati() {
  console.log('🔍 DEBUG Candidati - Componente renderizzato');
  
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const { data, isLoading, isError } = useElezioniData(user);
  const {
    opinioniDialogData,
    programmaDialogData,
    showOpinioniDialog,
    showProgrammaDialog,
    handleViewOpinioni,
    handleViewProgramma,
    handleCloseOpinioniDialog,
    handleCloseProgrammaDialog
  } = useElezioniActions();

  // Mostra loader durante l'autenticazione
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Redirect se non autenticato
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Controlla lo status dell'utente
  if (user.status === 'pending') {
    // Salva l'email per la verifica
    localStorage.setItem('user_email', user.email);
    localStorage.setItem('user_status', 'pending');
    localStorage.setItem('user_id', user.id);
    
    // Reindirizza alla verifica email
    window.location.href = `/verifica-email?email=${encodeURIComponent(user.email)}`;
    return null;
  }

  // Mostra loader durante il caricamento dei dati
  if (isLoading) {
    return <LoadingState />;
  }

  // Mostra errore se c'è un problema
  if (isError) {
    return <ErrorState />;
  }

  const { candidati, idMap } = data || { candidati: {}, idMap: {} };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            I Tuoi Candidati
          </h1>
          <p className="text-gray-600">
            Visualizza e gestisci i candidati che hai selezionato per le diverse elezioni
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Categoria principale (Elezioni Europee) */}
          <CategoriaPrincipale
            categoria="europeo"
            candidato={candidati.europeo}
            idMap={idMap}
            onViewOpinioni={handleViewOpinioni}
            onViewProgramma={handleViewProgramma}
          />

          {/* Altre categorie */}
          {categorie.filter(cat => cat !== 'europeo').map(categoria => (
            <CandidatoCard
              key={categoria}
              categoria={categoria}
              candidato={candidati[categoria]}
              idMap={idMap}
              onViewOpinioni={handleViewOpinioni}
              onViewProgramma={handleViewProgramma}
            />
          ))}
        </div>
      </div>

      {/* Dialog per visualizzare opinioni */}
      <ViewOpinioniDialog
        isOpen={showOpinioniDialog}
        onClose={handleCloseOpinioniDialog}
        data={opinioniDialogData}
      />

      {/* Dialog per visualizzare programma */}
      <ViewProgrammaDialog
        isOpen={showProgrammaDialog}
        onClose={handleCloseProgrammaDialog}
        data={programmaDialogData}
      />
    </div>
  );
}
