import React, { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-4xl">
        <Card>
          <CardContent className="p-6">
            <Header />
            
            {loadingData ? (
              <LoadingState />
            ) : (
              <div className="space-y-6">
                <ProponiForm
                  testoInput={proponiOpinioneState.testoInput}
                  submitting={proponiOpinioneState.submitting}
                  onSubmit={handleProponiSubmit}
                  onInputChange={(value) => updateField('testoInput', value)}
                  opinioniEsistenti={opinioni.map(op => op.testo)}
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
