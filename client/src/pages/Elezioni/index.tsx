import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";
import { ViewProgrammaDialog } from "@/components/ViewProgrammaDialog";
import { useElezioniData } from "./hooks/useElezioniData";
import { useElezioniActions } from "./hooks/useElezioniActions";
import { useElezioniUtils } from "./hooks/useElezioniUtils";
import { Header } from "./components/Header";
import { CategoriaPrincipale } from "./components/CategoriaPrincipale";
import { CategoriaSecondaria } from "./components/CategoriaSecondaria";
import { categorie, colorMap } from "./constants/categorie";

export default function Elezioni() {
  const { user, isLoading } = useAuth();
  
  const { userData, elezioni, candidatiDettagliati, loading } = useElezioniData(user);
  const {
    opinioniDialogData,
    programmaDialogData,
    handleOpenOpinioniDialog,
    handleCloseOpinioniDialog,
    handleOpenProgrammaDialog,
    handleCloseProgrammaDialog
  } = useElezioniActions();
  
  const { getElectionForCategory, formatElectionDates } = useElezioniUtils();

  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  if (isLoading || loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col overflow-hidden page-with-navbar">
        <div className="container mx-auto px-4 py-8">
          <Header />

          {/* Card principale - Parlamento Europeo */}
          <CategoriaPrincipale
            categoria={categorie[0]}
            userData={userData}
            candidatiDettagliati={candidatiDettagliati}
            elezione={getElectionForCategory(elezioni, categorie[0])}
            dateString={formatElectionDates(getElectionForCategory(elezioni, categorie[0]))}
            onOpenOpinioni={handleOpenOpinioniDialog}
            onOpenProgramma={handleOpenProgrammaDialog}
          />
          
          {/* Altre card in griglia 2x2 */}
          <div className="grid grid-cols-2 gap-4 pb-2">
            {categorie.slice(1).map((categoria) => {
              const color = colorMap[categoria.color as keyof typeof colorMap];
              const elezione = getElectionForCategory(elezioni, categoria);
              const dateString = formatElectionDates(elezione);
              
              return (
                <CategoriaSecondaria
                  key={categoria.id}
                  categoria={categoria}
                  userData={userData}
                  candidatiDettagliati={candidatiDettagliati}
                  elezione={elezione}
                  dateString={dateString}
                  color={color}
                  onOpenOpinioni={handleOpenOpinioniDialog}
                  onOpenProgramma={handleOpenProgrammaDialog}
                />
              );
            })}
          </div>
        </div>
        
        <ViewOpinioniDialog
          open={!!opinioniDialogData}
          onOpenChange={(open) => !open && handleCloseOpinioniDialog()}
          utenteId={opinioniDialogData?.utenteId || ''}
          nome={opinioniDialogData?.nome}
          cognome={opinioniDialogData?.cognome}
          avatarConfig={opinioniDialogData?.avatarConfig}
        />
        <ViewProgrammaDialog
          open={!!programmaDialogData}
          onOpenChange={(open) => !open && handleCloseProgrammaDialog()}
          utenteId={programmaDialogData?.utenteId || ''}
          nome={programmaDialogData?.nome}
          cognome={programmaDialogData?.cognome}
          avatarConfig={programmaDialogData?.avatarConfig}
        />
      </div>
    </PageTransition>
  );
}
