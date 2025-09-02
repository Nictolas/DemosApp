import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useGovernoData } from "./hooks/useGovernoData";
import { useGovernoActions } from "./hooks/useGovernoActions";
import { Header } from "./components/Header";
import { MinisteroCard } from "./components/MinisteroCard";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { SaveButton } from "./components/SaveButton";
import { ministeri } from "./constants/ministeri";

export default function Governo() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();

  const { data, isLoadingData, saveVotiMutation } = useGovernoData(user);
  const {
    governoState,
    handleChangeMinistro,
    handleRemoveVoto,
    handleSalvaVoti,
    toggleCategoryExpansion,
    closeConfirmDialog,
    getVotiCambiati
  } = useGovernoActions(data);

  const handleConfirmSave = () => {
    saveVotiMutation.mutate(governoState.selectedVoti);
  };

  if (!authReady || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  const unlockDate = data?.blocco.unlockDate ? new Date(data.blocco.unlockDate).toLocaleString('it-IT') : null;
  const votiCambiati = getVotiCambiati();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-7xl">
        <Header unlockDate={unlockDate} />
        
        {isLoadingData ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ministeri.map((ministero) => (
              <MinisteroCard
                key={ministero.categoria}
                ministero={ministero}
                selectedVoti={governoState.selectedVoti}
                expandedCategories={governoState.expandedCategories}
                data={data}
                onVotoChange={handleChangeMinistro}
                onVotoRemove={handleRemoveVoto}
                onToggleExpansion={toggleCategoryExpansion}
              />
            ))}
          </div>
        )}

        <SaveButton
          isBlocked={data?.blocco.isBlocked || false}
          votiCambiati={votiCambiati}
          isPending={saveVotiMutation.isPending}
          onSave={handleSalvaVoti}
        />

        <ConfirmDialog
          open={governoState.showConfirmDialog}
          onOpenChange={closeConfirmDialog}
          onConfirm={handleConfirmSave}
          isPending={saveVotiMutation.isPending}
        />
      </div>
    </div>
  );
}
