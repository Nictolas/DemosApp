import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "./components/Header";
import { CreateButton } from "./components/CreateButton";
import { IniziativaForm } from "./components/IniziativaForm";
import { IniziativeTable } from "./components/IniziativeTable";
import { EditDialog } from "./components/EditDialog";
import { ViewDialog } from "./components/ViewDialog";
import { useIniziativeData } from "./hooks/useIniziativeData";
import { useIniziativeActions } from "./hooks/useIniziativeActions";

export default function IniziativePopolari() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { listaIniziative, mieiVoti, isLoading, isError } = useIniziativeData(user);
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
            <CreateButton onClick={showCreateForm} />
          </div>
          
          {state.showForm && (
            <IniziativaForm
              onSubmit={handleCreate}
              onCancel={hideCreateForm}
              isLoading={addMutation.isPending}
            />
          )}
          
          <IniziativeTable
            listaIniziative={listaIniziative}
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
