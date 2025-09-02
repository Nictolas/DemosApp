import React, { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useProponiOpinioneData } from "./hooks/useProponiOpinioneData";
import { useProponiOpinioneActions } from "./hooks/useProponiOpinioneActions";
import { Header } from "./components/Header";
import { ProponiForm } from "./components/ProponiForm";
import { OpinioniList } from "./components/OpinioniList";
import { LoadingState } from "./components/LoadingState";

export default function ProponiOpinione() {
  const { user, isLoading } = useAuth();

  const {
    opinioni,
    loadingData,
    userVoti,
    handleProponi,
    handleVota,
    handleSalvaVoti
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
    setSubmitting(true);
    const success = await handleProponi(proponiOpinioneState.testoInput);
    if (success) {
      updateField('testoInput', '');
    }
    setSubmitting(false);
  };

  const handleVotaOpinione = async (id: string) => {
    setIsVoting(true);
    await handleVota(id);
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
            />

            <OpinioniList
              opinioni={opinioni}
              userVoti={userVoti}
              isVoting={proponiOpinioneState.isVoting}
              onVota={handleVotaOpinione}
            />
          </div>
        )}
      </div>
    </div>
  );
}
