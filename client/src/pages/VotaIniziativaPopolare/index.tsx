import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useIniziativeData } from "./hooks/useIniziativeData";
import { useIniziativeVoting } from "./hooks/useIniziativeVoting";
import { Header } from "./components/Header";
import { UserPreferences } from "./components/UserPreferences";
import { IniziativeRanking } from "./components/IniziativeRanking";
import { SaveButton } from "./components/SaveButton";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AdminIniziativeManager } from "./components/AdminIniziativeManager";

export default function VotaIniziativaPopolare() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();

  // Hook per i dati
  const { data, isLoading: isLoadingData, error } = useIniziativeData(user);

  // Hook per la logica di voto
  const {
    selectedVoti,
    showConfirmDialog,
    setShowConfirmDialog,
    saveVotiMutation,
    toggleSelezione,
    toggleSelezioneClassifica,
    votiCambiati
  } = useIniziativeVoting(data);

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
            {/* Sezione Admin - Gestisci Iniziative Popolari */}
            <AdminIniziativeManager 
              userRole={user?.ruolo || user?.role} 
              userEmail={user?.email}
            />


            {/* Le tue preferenze */}
            <UserPreferences
              selectedVoti={selectedVoti}
              iniziative={data?.iniziative || []}
              onRemoveVoto={toggleSelezione}
            />

            {/* Classifica */}
            <IniziativeRanking
              classifica={data?.classifica || []}
              iniziative={data?.iniziative || []}
              selectedVoti={selectedVoti}
              onToggleSelezioneClassifica={toggleSelezioneClassifica}
              isBlocked={data?.blocco?.isBlocked || false}
              isPending={saveVotiMutation.isPending}
            />

            {/* Pulsante salvataggio */}
            <SaveButton
              onSave={() => setShowConfirmDialog(true)}
              isPending={saveVotiMutation.isPending}
              votiCambiati={votiCambiati}
              isBlocked={data?.blocco?.isBlocked || false}
              userRole={user?.ruolo || user?.role}
            />
          </div>
        )}
      </div>

      {/* Dialog di conferma */}
      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={() => saveVotiMutation.mutate(selectedVoti)}
        isPending={saveVotiMutation.isPending}
      />
    </div>
  );
}
