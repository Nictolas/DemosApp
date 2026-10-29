import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import "../SelectionGrid.css";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";
import { useRappresentantiData } from "./hooks/useRappresentantiData";
import { useRappresentantiActions } from "./hooks/useRappresentantiActions";
import { CategoriaPrincipale } from "./components/CategoriaPrincipale";
import { RappresentanteCard } from "./components/RappresentanteCard";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { categorie } from "./constants/categorie";

export default function Rappresentanti() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { data, isLoading, isError } = useRappresentantiData(user);
  const {
    opinioniDialogData,
    handleNavigateToSelection,
    handleOpenOpinioniDialog,
    handleCloseOpinioniDialog,
  } = useRappresentantiActions();

  if (isAuthLoading) {
    return (
      <PageContainer className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className="rappresentanti-page selection-grid-page select-none">
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
              <RappresentanteCard
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
          utenteId={opinioniDialogData?.utenteId || ""}
          nome={opinioniDialogData?.nome}
          cognome={opinioniDialogData?.cognome}
          avatarConfig={opinioniDialogData?.avatarConfig}
          categoria={opinioniDialogData?.categoria as any}
        />
      )}
    </PageContainer>
  );
}
