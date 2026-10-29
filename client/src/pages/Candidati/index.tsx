import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import "../SelectionGrid.css";
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

  // Debug logging ridotto
  console.log('🔍 DEBUG Candidati - Stato:', { isAuthLoading, user: !!user, isLoading, isError, hasData: !!data });

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
    <PageContainer className="selection-grid-page select-none">
      <div className="selection-grid-page__content container mx-auto w-full max-w-full px-4 pt-2 pb-2">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState />
        ) : (
          <div className="selection-grid-page__grid">
            <CategoriaPrincipale
              key={categorie[0].id}
              categoria={categorie[0]}
              data={data}
              onNavigate={handleNavigateToSelection}
              onOpenOpinioni={handleOpenOpinioniDialog}
            />
            {categorie.slice(1).map((categoria) => (
              <CandidatoCard
                key={categoria.id}
                categoria={categoria}
                data={data}
                onNavigate={handleNavigateToSelection}
                onOpenOpinioni={handleOpenOpinioniDialog}
              />
            ))}
          </div>
        )}
      </div>
      {opinioniDialogData && (
        <ViewOpinioniDialog
          open={!!opinioniDialogData}
          onOpenChange={(open) => !open && handleCloseOpinioniDialog()}
          utenteId={opinioniDialogData.utenteId}
          nome={opinioniDialogData.nome}
          cognome={opinioniDialogData.cognome}
          avatarConfig={opinioniDialogData.avatarConfig}
          categoria={opinioniDialogData.categoria as any}
        />
      )}
    </PageContainer>
  );
}
