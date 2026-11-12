import React, { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/PageContainer";
import { useProponiOpinioneData } from "./hooks/useProponiOpinioneData";
import { useProponiOpinioneActions } from "./hooks/useProponiOpinioneActions";
import { Header } from "./components/Header";
import { ProponiForm } from "./components/ProponiForm";
import { OpinioniList } from "./components/OpinioniList";
import { LoadingState } from "./components/LoadingState";

export default function ProponiOpinione() {
  const { user, isLoading } = useAuth();
  const isSubmittingRef = useRef(false);

  const {
    opinioni,
    loadingData,
    userVoti,
    haGiaProposto,
    handleProponi,
    handleVota,
    handleRimuoviVoto,
    handleSalvaVoti,
    handleCancella
  } = useProponiOpinioneData(user);

  const {
    proponiOpinioneState,
    updateField,
    setSubmitting,
    setIsVoting,
    setOpinioni,
    setUserVoti,
    setLoadingData
  } = useProponiOpinioneActions(user);

  // Sincronizza i dati tra i due hooks
  useEffect(() => {
    setOpinioni(opinioni);
    setUserVoti(userVoti);
    setLoadingData(loadingData);
  }, [opinioni, userVoti, loadingData, setOpinioni, setUserVoti, setLoadingData]);

  const handleProponiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Previeni doppi invii con ref per evitare race conditions
    if (isSubmittingRef.current || proponiOpinioneState.submitting) {
      console.log('⚠️ Submit bloccato - già in corso');
      return;
    }
    
    isSubmittingRef.current = true;
    setSubmitting(true);
    
    try {
      console.log('📝 Avvio submit opinione:', proponiOpinioneState.testoInput);
      const success = await handleProponi(proponiOpinioneState.testoInput);
      if (success) {
        updateField('testoInput', '');
        console.log('✅ Submit completato con successo');
      } else {
        console.log('❌ Submit fallito');
      }
    } catch (error) {
      console.error('❌ Errore durante submit:', error);
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
      console.log('🔄 Stato submit resettato');
    }
  };

  const handleVotaOpinione = async (id: string) => {
    setIsVoting(true);
    await handleVota(id);
    setIsVoting(false);
  };

  const handleRimuoviVotoOpinione = async (id: string) => {
    setIsVoting(true);
    await handleRimuoviVoto(id);
    setIsVoting(false);
  };

  const handleCancellaOpinione = async (id: string) => {
    setIsVoting(true);
    await handleCancella(id);
    setIsVoting(false);
  };

  const handleConfermaSalva = async () => {
    setIsVoting(true);
    await handleSalvaVoti(proponiOpinioneState.selectedVoti);
    setIsVoting(false);
  };

  if (isLoading) {
    return (
      <PageContainer className="items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className="overflow-hidden bg-gradient-to-b from-background to-secondary/20">
      {/* Scroll only the page content; the fixed mobile navbar stays visible. */}
      <div
        className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4"
        role="region"
        aria-label="Opinioni proposte"
        tabIndex={0}
      >
      <div className="container mx-auto max-w-4xl">
        <Card className="bg-white">
          <Header />
          <CardContent className="p-6 pt-0 space-y-6">
            {loadingData ? (
              <LoadingState />
            ) : (
              <>
                <ProponiForm
                  testoInput={proponiOpinioneState.testoInput}
                  submitting={proponiOpinioneState.submitting}
                  onSubmit={handleProponiSubmit}
                  onInputChange={(value) => updateField('testoInput', value)}
                  opinioniEsistenti={opinioni.map(op => op.testo)}
                  haGiaProposto={haGiaProposto}
                />

                <OpinioniList
                  opinioni={opinioni}
                  userVoti={userVoti}
                  isVoting={proponiOpinioneState.isVoting}
                  onVota={handleVotaOpinione}
                  onRimuoviVoto={handleRimuoviVotoOpinione}
                  onCancella={handleCancellaOpinione}
                  isAdmin={user?.ruolo === 'AD'}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </PageContainer>
  );
}
