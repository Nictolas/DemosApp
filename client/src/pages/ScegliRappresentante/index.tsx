import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect, useParams, useLocation } from "wouter";
import { PageTransition } from "@/components/PageTransition";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";
import { useFCM } from "@/hooks/useFCM";
import { useRappresentantiData } from "./hooks/useRappresentantiData";
import { useRappresentantiActions } from "./hooks/useRappresentantiActions";
import { Header } from "./components/Header";
import { EmptyState } from "./components/EmptyState";
import { RappresentanteCard } from "./components/RappresentanteCard";
import { LoadingStates } from "./components/LoadingStates";
import { OpinioniIncompleteAlert } from "./components/OpinioniIncompleteAlert";
import { getTitolo } from "./utils/rappresentanteUtils";

export default function ScegliRappresentante() {
  const { categoria } = useParams<{ categoria: string }>();
  const { user, isLoading } = useAuth();
  const authReady = useAuthReady();
  const { token: fcmToken } = useFCM();
  const [, setLocation] = useLocation();

  const { 
    rappresentanti, 
    loading, 
    rappresentanteSelezionato, 
    setRappresentanteSelezionato,
    showOpinioniAlert,
    setShowOpinioniAlert,
    opinioniAlertData
  } = useRappresentantiData(user, categoria || '');

  // Debug completo
  console.log('🔍 DEBUG ScegliRappresentante - authReady:', authReady);
  console.log('🔍 DEBUG ScegliRappresentante - isLoading:', isLoading);
  console.log('🔍 DEBUG ScegliRappresentante - loading:', loading);
  console.log('🔍 DEBUG ScegliRappresentante - rappresentanti:', rappresentanti);
  console.log('🔍 DEBUG ScegliRappresentante - rappresentanti.length:', rappresentanti.length);
  console.log('🔍 DEBUG ScegliRappresentante - showOpinioniAlert:', showOpinioniAlert);
  console.log('🔍 DEBUG ScegliRappresentante - opinioniAlertData:', opinioniAlertData);

  const {
    selezionando,
    opinioniDialogData,
    selezionaRappresentante,
    openOpinioniDialog,
    closeOpinioniDialog
  } = useRappresentantiActions(user, categoria || '', fcmToken);

  const handleSelezionaRappresentante = (rappresentanteId: string) => {
    selezionaRappresentante(rappresentanteId, setRappresentanteSelezionato);
  };

  const handleGoToOpinions = () => {
    setShowOpinioniAlert(false);
    setLocation('/opinioni');
  };

  const handleContinueAnyway = () => {
    setShowOpinioniAlert(false);
  };

  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  // Mostra il loader se auth non è pronto o se sta caricando
  if (!authReady || isLoading || loading) {
    console.log('🔍 DEBUG ScegliRappresentante - Mostrando loader:', { authReady, isLoading, loading });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingStates 
          authReady={authReady} 
          isLoading={isLoading} 
          loading={loading} 
        />
      </div>
    );
  }

  console.log('🔍 DEBUG ScegliRappresentante - Render principale, rappresentanti:', rappresentanti.length);
  console.log('🔍 DEBUG ScegliRappresentante - selezionando:', selezionando);
  console.log('🔍 DEBUG ScegliRappresentante - rappresentanteSelezionato:', rappresentanteSelezionato);
  console.log('🔍 DEBUG ScegliRappresentante - categoria:', categoria);

  // Test diretto per vedere se il problema è nel rendering
  const renderContent = () => {
    console.log('🔍 DEBUG ScegliRappresentante - renderContent chiamato, rappresentanti.length:', rappresentanti.length);
    
    if (rappresentanti.length === 0) {
      console.log('🔍 DEBUG ScegliRappresentante - Renderizzando EmptyState');
      return <EmptyState categoria={categoria || ''} getTitolo={() => getTitolo(categoria || '')} />;
    }
    
    console.log('🔍 DEBUG ScegliRappresentante - Renderizzando grid con', rappresentanti.length, 'rappresentanti');
    return (
      <div className="flex-1 flex items-center justify-center py-4" style={{ minHeight: '400px', backgroundColor: '#f0f0f0' }}>
        <div className="grid grid-cols-2 gap-4 w-full max-w-2xl" style={{ backgroundColor: '#e0e0e0', padding: '20px' }}>
          {console.log('🔍 DEBUG ScegliRappresentante - Dentro la grid, iniziando map')}
          {rappresentanti.map((rappresentante, index) => {
            console.log(`🔍 DEBUG ScegliRappresentante - Map iterazione ${index}:`, {
              id: rappresentante.id,
              nome: rappresentante.nome,
              cognome: rappresentante.cognome,
              isSelected: rappresentante.id === rappresentanteSelezionato
            });
            return (
              <div key={rappresentante.id} style={{ backgroundColor: 'white', padding: '10px', border: '2px solid red' }}>
                <RappresentanteCard
                  rappresentante={rappresentante}
                  isSelected={rappresentante.id === rappresentanteSelezionato}
                  isSelezionando={selezionando}
                  onSeleziona={handleSelezionaRappresentante}
                  onViewOpinioni={openOpinioniDialog}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // TEMPORANEO: Rimuoviamo PageTransition per testare
  return (
    <>
      <div className="min-h-screen flex flex-col page-with-navbar" style={{ backgroundColor: '#ffcccc' }}>
        <div className="container mx-auto px-4 py-4 flex-1 flex flex-col" style={{ backgroundColor: '#ccffcc' }}>
          <Header categoria={categoria || ''} getTitolo={() => getTitolo(categoria || '')} />
          
          {opinioniDialogData && (
            <ViewOpinioniDialog
              open={!!opinioniDialogData}
              onOpenChange={(open) => { if (!open) closeOpinioniDialog(); }}
              utenteId={opinioniDialogData.utenteId}
              nome={opinioniDialogData.nome}
              cognome={opinioniDialogData.cognome}
              avatarConfig={opinioniDialogData.avatarConfig}
              categoria={categoria || ''}
            />
          )}
          
          {renderContent()}
        </div>
      </div>
      
      {/* Alert per opinioni incomplete */}
      {showOpinioniAlert && opinioniAlertData && (
        <OpinioniIncompleteAlert
          open={showOpinioniAlert}
          onOpenChange={setShowOpinioniAlert}
          data={opinioniAlertData}
          onGoToOpinions={handleGoToOpinions}
          onContinueAnyway={handleContinueAnyway}
        />
      )}
    </>
  );
}
