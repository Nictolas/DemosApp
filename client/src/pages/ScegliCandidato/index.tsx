import React, { useEffect, useState } from "react";
import { useParams, Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-neon";
import { useCandidatiData } from "./hooks/useCandidatiData";
import { useCandidatiActions } from "./hooks/useCandidatiActions";
import { LoadingStates } from "@/components/LoadingStates";
import { PageTransition } from "@/components/PageTransition";
import { Header } from "./components/Header";
import { EmptyState } from "./components/EmptyState";
import { CandidatoCard } from "./components/CandidatoCard";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";
import { getTitolo, getFieldName } from "./utils/candidatoUtils";

export default function ScegliCandidato() {
  const { categoria } = useParams<{ categoria: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const { candidati, loading: dataLoading, candidatoSelezionato, setCandidatoSelezionato } = useCandidatiData(user, categoria || '');
  const { selezionando, opinioniDialogData, selezionaCandidato, openOpinioniDialog, closeOpinioniDialog } = useCandidatiActions(user, categoria || '', null);

  // Gestione stato di caricamento
  useEffect(() => {
    if (!authLoading) {
      setAuthReady(true);
    }
  }, [authLoading]);

  useEffect(() => {
    if (authReady && !dataLoading) {
      setLoading(false);
    }
  }, [authReady, dataLoading]);

  const handleSelezionaCandidato = async (candidatoId: string) => {
    await selezionaCandidato(candidatoId, (id: string) => {
      setCandidatoSelezionato(id);
      // Invalida la query dei candidati per aggiornare la pagina test
      queryClient.invalidateQueries({ queryKey: ['testSelezioni'] });
    });
  };

  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col overflow-hidden page-with-navbar">
        <div className="container mx-auto px-4 py-4 flex-1 flex flex-col">
          <LoadingStates 
            authReady={authReady} 
            isLoading={isLoading} 
            loading={loading} 
          />
          
          <Header categoria={categoria || ''} getTitolo={() => getTitolo(categoria || '')} />
          
          <ViewOpinioniDialog
            open={!!opinioniDialogData}
            onOpenChange={(open) => { if (!open) closeOpinioniDialog(); }}
            utenteId={opinioniDialogData?.utenteId || ''}
            nome={opinioniDialogData?.nome}
            cognome={opinioniDialogData?.cognome}
            avatarConfig={opinioniDialogData?.avatarConfig}
          />
          
          {candidati.length === 0 ? (
            <EmptyState categoria={categoria || ''} getTitolo={() => getTitolo(categoria || '')} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="grid grid-cols-2 gap-4 w-full max-w-2xl" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                {candidati.map((candidato) => (
                  <CandidatoCard
                    key={candidato.id}
                    candidato={candidato}
                    isSelected={candidato.id === candidatoSelezionato}
                    isSelezionando={selezionando}
                    onSeleziona={handleSelezionaCandidato}
                    onViewOpinioni={openOpinioniDialog}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
