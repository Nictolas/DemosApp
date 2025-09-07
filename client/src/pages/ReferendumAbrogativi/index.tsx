import React, { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "./components/Header";
import { CreateButton } from "./components/CreateButton";
import { ReferendumForm } from "./components/ReferendumForm";
import { ReferendumTable } from "./components/ReferendumTable";
import { EditDialog } from "./components/EditDialog";
import { useReferendumData } from "./hooks/useReferendumData";
import { useReferendumActions } from "./hooks/useReferendumActions";
import { useReferendumForms } from "./hooks/useReferendumForms";

export default function ReferendumAbrogativi() {
  const { user, isLoading: isAuthLoading } = useAuth();
  
  // Hooks per la gestione dei dati e delle azioni
  const { listaReferendum, isLoading, isError } = useReferendumData(user);
  const {
    state,
    createMutation,
    updateMutation,
    deleteMutation,
    quorumMutation,
    showCreateForm,
    hideCreateForm,
    startEdit,
    cancelEdit,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleQuorumChange
  } = useReferendumActions();
  
  const { createForm, editForm, resetCreateForm } = useReferendumForms();

  // Reset del form quando si nasconde
  useEffect(() => {
    if (!state.showForm) {
      resetCreateForm();
    }
  }, [state.showForm, resetCreateForm]);

  // Loading state per l'autenticazione
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect se non autenticato
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar">
      <div className="container mx-auto max-w-7xl p-6">
        <Card>
          <CardContent className="p-6">
            <Header />

            {/* Pulsante per creare nuovo referendum */}
            <CreateButton
              showForm={state.showForm}
              onToggle={state.showForm ? hideCreateForm : showCreateForm}
            />

            {/* Form di creazione */}
            {state.showForm && (
              <div className="mb-8">
                <ReferendumForm
                  form={createForm}
                  onSubmit={handleCreate}
                  onCancel={hideCreateForm}
                  isPending={createMutation.isPending}
                  title="Nuovo Referendum Abrogativo"
                />
              </div>
            )}

            {/* Tabella dei referendum */}
            <ReferendumTable
              listaReferendum={listaReferendum}
              isLoading={isLoading}
              isError={isError}
              onEdit={startEdit}
              onDelete={handleDelete}
              onQuorumChange={handleQuorumChange}
              deleteMutation={deleteMutation}
              quorumMutation={quorumMutation}
            />
          </CardContent>
        </Card>

        {/* Dialog di modifica */}
        <EditDialog
          open={!!state.editReferendum}
          onOpenChange={(open) => {
            if (!open) cancelEdit();
          }}
          referendum={state.editReferendum}
          form={editForm}
          onSubmit={handleUpdate}
          isPending={updateMutation.isPending}
        />
      </div>
    </div>
  );
}
