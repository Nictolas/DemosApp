import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useReferendumData } from "./hooks/useReferendumData";
import { useReferendumVoting } from "./hooks/useReferendumVoting";
import { Header } from "./components/Header";
import { UserPreferences } from "./components/UserPreferences";
import { ReferendumTable } from "./components/ReferendumTable";
import { ReferendumRanking } from "./components/ReferendumRanking";
import { SaveButton } from "./components/SaveButton";

export default function VotaReferendumAbrogativo() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();

  // Hook per i dati dei referendum
  const { data, isLoading: isLoadingData, error } = useReferendumData(user);

  // Hook per la logica di voto
  const {
    selectedVoti,
    saveVotiMutation,
    toggleSelezione,
    toggleSelezioneClassifica,
    votiCambiati
  } = useReferendumVoting(data);

  // Loading states
  if (!authReady || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect se non autenticato
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-4xl">
        <Header />

        {isLoadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-800 rounded">
            <b>Errore nel caricamento dei dati:</b><br />
            {error.message}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Le tue preferenze */}
            <UserPreferences
              selectedVoti={selectedVoti}
              referendum={data?.referendum || []}
              onToggleSelezione={toggleSelezione}
            />

            {/* Classifica */}
            <ReferendumRanking
              classifica={data?.classifica || []}
              referendum={data?.referendum || []}
              selectedVoti={selectedVoti}
              onToggleSelezioneClassifica={toggleSelezioneClassifica}
              isBlocked={data?.blocco?.isBlocked || false}
              isPending={saveVotiMutation.isPending}
            />

            {/* Pulsante salvataggio */}
            <SaveButton
              onSave={() => saveVotiMutation.mutate(selectedVoti)}
              isPending={saveVotiMutation.isPending}
              votiCambiati={votiCambiati}
              isBlocked={data?.blocco?.isBlocked || false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
