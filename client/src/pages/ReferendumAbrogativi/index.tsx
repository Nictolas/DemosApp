import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "./components/Header";
import { CreateButton } from "./components/CreateButton";
import { ReferendumForm } from "./components/ReferendumForm";
import { ReferendumTable } from "./components/ReferendumTable";
import { EditDialog } from "./components/EditDialog";
import { ViewDialog } from "./components/ViewDialog";
import { useReferendumData } from "./hooks/useReferendumData";
import { useReferendumActions } from "./hooks/useReferendumActions";
import { useReferendumForms } from "./hooks/useReferendumForms";

export default function ReferendumAbrogativi() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { listaReferendum, mieiVoti, isLoading, isError } = useReferendumData(user);
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
    handleDelete
  } = useReferendumActions();

  const { createForm, editForm, resetCreateForm } = useReferendumForms();

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
            <CreateButton onClick={showCreateForm} />
          </div>
          
          {state.showForm && (
            <ReferendumForm
              onSubmit={handleCreate}
              onCancel={hideCreateForm}
              isLoading={addMutation.isPending}
            />
          )}
          
          <ReferendumTable
            listaReferendum={listaReferendum}
            mieiVoti={mieiVoti}
            isLoading={isLoading}
            isError={isError}
            onView={startEditView}
          />
        </CardContent>
      </Card>
      
      <EditDialog
        referendum={state.editReferendum}
        onClose={cancelEdit}
        onSubmit={handleUpdate}
        isLoading={editMutation.isPending}
      />

      <ViewDialog
        referendum={state.viewReferendum}
        onClose={closeView}
        onEdit={startEdit}
        onDelete={handleDelete}
        deleteMutation={deleteMutation}
      />
    </div>
  );
}
