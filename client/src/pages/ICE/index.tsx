import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "./components/Header";
import { CreateButton } from "./components/CreateButton";
import { ICEForm } from "./components/ICEForm";
import { ICETable } from "./components/ICETable";
import { EditDialog } from "./components/EditDialog";
import { ViewDialog } from "./components/ViewDialog";
import { ICEStatsChart } from "./components/ICEStatsChart";
import { useICEData } from "./hooks/useICEData";
import { useICEActions } from "./hooks/useICEActions";
import { useICEForms } from "./hooks/useICEForms";

export default function ICE() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { 
    listaICE, 
    mieiVoti, 
    isLoading, 
    isError,
    currentProposals,
    limit,
    remainingProposals,
    hasReachedLimit
  } = useICEData(user);
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
  } = useICEActions();

  const { createForm, editForm, resetCreateForm } = useICEForms();


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
          
          {/* Grafico statistiche ICE */}
          <ICEStatsChart listaICE={listaICE} />
          
          
          <div className="flex justify-start items-center mb-4">
            <CreateButton 
              onClick={showCreateForm} 
              disabled={hasReachedLimit}
              currentProposals={currentProposals}
              limit={limit}
            />
          </div>
          
          {state.showForm && (
            <ICEForm
              onSubmit={(data) => handleCreate(data, currentProposals)}
              onCancel={hideCreateForm}
              isLoading={addMutation.isPending}
            />
          )}
          
          <ICETable
            listaICE={listaICE}
            mieiVoti={mieiVoti}
            isLoading={isLoading}
            isError={isError}
            onView={startEditView}
          />
        </CardContent>
      </Card>
      
      <EditDialog
        ice={state.editICE}
        onClose={cancelEdit}
        onSubmit={handleUpdate}
        isLoading={editMutation.isPending}
      />

      <ViewDialog
        ice={state.viewICE}
        onClose={closeView}
        onEdit={startEdit}
        onDelete={handleDelete}
        deleteMutation={deleteMutation}
      />
    </div>
  );
}
