import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";
import { useCandidatiData } from "./hooks/useCandidatiData";
import { useCandidatiActions } from "./hooks/useCandidatiActions";
import { CategoriaPrincipale } from "./components/CategoriaPrincipale";
import { CandidatoCard } from "./components/CandidatoCard";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { categorie, colorMap } from "./constants/categorie";

export default function Candidati() {
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const { data, isLoading, isError } = useCandidatiData(user);
  const {
    opinioniDialogData,
    handleNavigateToSelection,
    handleOpenOpinioniDialog,
    handleCloseOpinioniDialog
  } = useCandidatiActions();

  // Debug logging più dettagliato
  console.log('🔍 DEBUG Candidati - Valori singoli:');
  console.log('  isAuthLoading:', isAuthLoading);
  console.log('  user:', !!user);
  console.log('  isLoading:', isLoading);
  console.log('  isError:', isError);
  console.log('  data:', data);
  console.log('  data type:', typeof data);
  console.log('  data keys:', data ? Object.keys(data) : 'data è null/undefined');
  console.log('  candidati:', data?.candidati);
  console.log('  idMap:', data?.idMap);
  
  // Log della condizione di rendering
  const hasData = !!data;
  // Rimuovo completamente i controlli hasCandidati e hasIdMap
  // Le card devono essere sempre visibili per permettere la selezione
  
  console.log('🔍 DEBUG Rendering conditions:');
  console.log('  hasData:', hasData);
  console.log('  Mostrando sempre le card per permettere selezione candidati');

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

  return (
    <PageTransition>
      <style jsx global>{`
        body, html {
          overflow: hidden !important;
          touch-action: none !important;
        }
      `}</style>
                      <div className="h-screen flex flex-col overflow-hidden select-none overflow-x-hidden overflow-y-hidden touch-pan-x-none touch-pan-y-none" style={{ paddingBottom: '120px' }}>
        <div className="container mx-auto px-4 pt-4 overflow-hidden max-w-full h-full">
          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState />
          ) : (
            <>
              {/* Card Parlamento Europeo */}
              {(() => {
                const categoria = categorie[0];
                console.log('🔍 DEBUG: Rendering categoria:', categoria.id, categoria.nome);
                return (
                  <CategoriaPrincipale
                    key={categoria.id}
                    categoria={categoria}
                    data={data}
                    onNavigate={handleNavigateToSelection}
                    onOpenOpinioni={handleOpenOpinioniDialog}
                  />
                );
              })()}
              
              {/* Altre card */}
              <div className="grid grid-cols-2 gap-2">
                {categorie.slice(1).map((categoria) => {
                  return (
                    <CandidatoCard
                      key={categoria.id}
                      categoria={categoria}
                      data={data}
                      onNavigate={handleNavigateToSelection}
                      onOpenOpinioni={handleOpenOpinioniDialog}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
        
        {opinioniDialogData && (
          <ViewOpinioniDialog
            open={!!opinioniDialogData}
            onOpenChange={(open) => !open && handleCloseOpinioniDialog()}
            utenteId={opinioniDialogData?.utenteId || ''}
            nome={opinioniDialogData?.nome}
            cognome={opinioniDialogData?.cognome}
            avatarConfig={opinioniDialogData?.avatarConfig}
            categoria={opinioniDialogData?.categoria as any}
          />
        )}
      </div>
    </PageTransition>
  );
}
