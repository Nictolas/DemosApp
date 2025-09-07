import React from "react";
import { useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { useMinisteroData } from "./hooks/useMinisteroData";
import { useMinisteroActions } from "./hooks/useMinisteroActions";
import { Header } from "./components/Header";
import { TopTen } from "./components/TopTen";
import { VotingForm } from "./components/VotingForm";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { ministeri } from "../constants/ministeri";

export default function MinisteroPage() {
  const authReady = useAuthReady();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  
  // Trova il ministero corrispondente
  const ministero = ministeri.find(m => m.slug === slug);
  
  const { data, isLoading, isError, saveVotiMutation } = useMinisteroData(user, ministero?.categoria);
  const { 
    votingState, 
    updateField, 
    addNomeLocal, 
    removeLocal, 
    toggleSelezioneClassifica, 
    showClassifica, 
    saveVoti 
  } = useMinisteroActions(data);


  const handleSaveVoti = () => {
    saveVotiMutation.mutate(votingState.selectedVoti, {
      onSuccess: () => {
        saveVoti();
      }
    });
  };

  if (isAuthLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (!ministero) {
    return <Redirect to="/governo" />;
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
        <div className="container mx-auto max-w-4xl">
          <Header ministero={ministero} unlockDate={data?.blocco.unlockDate} />
          
          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState />
          ) : (
            <div className="space-y-6">
              {/* TEST COMPONENTE SEMPLICE */}
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold mb-4">Top 3 Candidati per {ministero?.nome}</h2>
                {data?.classifiche?.map((candidato, index) => (
                  <div key={candidato.nome} className="flex justify-between items-center p-3 border rounded mb-2">
                    <span className="font-medium">{index + 1}. {candidato.nome}</span>
                    <span className="bg-blue-100 px-2 py-1 rounded">{candidato.voti} voti</span>
                  </div>
                ))}
              </div>

              {/* FORM VOTO SEMPLICE */}
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold mb-4">Vota per {ministero?.nome}</h2>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Inserisci nome candidato..." 
                    className="w-full p-3 border rounded"
                  />
                  <button className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600">
                    Salva Voto
                  </button>
                </div>
              </div>

              <TopTen
                classifiche={data?.classifiche || []}
                selectedVoti={votingState.selectedVoti}
                onToggleSelezione={toggleSelezioneClassifica}
                showAllClassifica={votingState.showAllClassifica}
              />
              
              <VotingForm
                votingState={votingState}
                data={data}
                onUpdateField={updateField}
                onAddNome={addNomeLocal}
                onRemove={removeLocal}
                onShowForm={showClassifica}
                onSaveVoti={handleSaveVoti}
              />
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
