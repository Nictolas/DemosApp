import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "./components/Header";
import { CreateButton } from "./components/CreateButton";
import { IniziativaForm } from "./components/IniziativaForm";
import { IniziativeTable } from "./components/IniziativeTable";
import { IniziativeProposte } from "./components/IniziativeProposte";
import { MiaIniziativaProposta } from "./components/MiaIniziativaProposta";
import { EditDialog } from "./components/EditDialog";
import { ViewDialog } from "./components/ViewDialog";
import { useIniziativeData } from "./hooks/useIniziativeData";
import { useIniziativeActions } from "./hooks/useIniziativeActions";
import { IniziativeStatsChart } from "./components/IniziativeStatsChart";

export default function IniziativePopolari() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { 
    listaIniziative, 
    iniziativeUfficiali,
    iniziativeProposte,
    miaIniziativaProposta,
    mieiVoti, 
    isLoading, 
    isError,
    currentProposals,
    limit,
    remainingProposals,
    hasReachedLimit
  } = useIniziativeData(user);
  const {
    state,
    addMutation,
    editMutation,
    deleteMutation,
    showCreateForm,
    hideCreateForm,
    startEdit,
    cancelEdit,
    startEditView,
    closeView,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleApprove,
    handleReject
  } = useIniziativeActions();


  // Redirect se non autenticato
  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full rounded-2xl shadow-lg bg-white">
        <CardContent className="p-6">
          <Header />
          
          
          <div className="flex justify-start items-center mb-4">
            <CreateButton 
              onClick={showCreateForm} 
              disabled={hasReachedLimit || !!miaIniziativaProposta}
              currentProposals={currentProposals}
              limit={limit}
            />
          </div>
          
          {state.showForm && (
            <IniziativaForm
              onSubmit={(data) => handleCreate(data, currentProposals)}
              onCancel={hideCreateForm}
              isLoading={addMutation.isPending}
            />
          )}
          
          {/* Sezione: La mia iniziativa proposta */}
          {miaIniziativaProposta && (
            <div className="mb-8">
              <MiaIniziativaProposta
                iniziativa={miaIniziativaProposta}
                onDelete={handleDelete}
                isDeleting={deleteMutation.isPending}
              />
            </div>
          )}
          
          <IniziativeStatsChart listaIniziative={listaIniziative} />
          
          {/* Sezione per Admin: Iniziative Proposte */}
          {user?.ruolo === 'AD' && iniziativeProposte.length > 0 && (
            <div className="mb-8">
              <IniziativeProposte
                iniziativeProposte={iniziativeProposte}
                isLoading={isLoading}
                isError={isError}
                onView={startEditView}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            </div>
          )}
          
          {/* Iniziative Ufficiali */}
          <IniziativeTable
            listaIniziative={iniziativeUfficiali}
            mieiVoti={mieiVoti}
            isLoading={isLoading}
            isError={isError}
            onView={startEditView}
          />
        </CardContent>
      </Card>
      
      <EditDialog
        iniziativa={state.editIniziativa}
        onClose={cancelEdit}
        onSubmit={handleUpdate}
        isLoading={editMutation.isPending}
      />

      <ViewDialog
        iniziativa={state.viewIniziativa}
        onClose={closeView}
        onEdit={startEdit}
        onDelete={handleDelete}
        deleteMutation={deleteMutation}
      />
    </div>
  );
}
