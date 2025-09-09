import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
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
  
  // Debug logging rimosso per test
  const {
    opinioniDialogData,
    handleNavigateToSelection,
    handleOpenOpinioniDialog,
    handleCloseOpinioniDialog
  } = useCandidatiActions();

  const hasData = !!data;
  
  // Log della condizione di rendering rimosso per test

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
    <div className="h-screen flex flex-col overflow-hidden select-none overflow-x-hidden overflow-y-hidden touch-pan-x-none touch-pan-y-none" style={{ paddingBottom: '120px' }}>
      <style jsx global>{`
        body, html {
          overflow: hidden !important;
          touch-action: none !important;
        }
      `}</style>
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
  );
}
