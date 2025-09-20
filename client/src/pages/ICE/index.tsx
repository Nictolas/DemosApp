import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "./components/Header";
import { CreateButton } from "./components/CreateButton";
import { ICEForm } from "./components/ICEForm";
import { ICETable } from "./components/ICETable";
import { EditDialog } from "./components/EditDialog";
import { useICEData } from "./hooks/useICEData";
import { useICEActions } from "./hooks/useICEActions";
import { useICEForms } from "./hooks/useICEForms";

export default function ICE() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { listaICE, mieiVoti, isLoading, isError } = useICEData(user);
  const {
    state,
    addMutation,
    editMutation,
    deleteMutation,
    showCreateForm,
    hideCreateForm,
    startEdit,
    cancelEdit,
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
      <div className="relative w-full rounded-2xl shadow-lg overflow-hidden">
        {/* SVG con forme geometriche colorate come nelle altre pagine */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon points="100,0 0,0 0,35 100,20" fill="#dbeafe" />
          <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
        </svg>
        
        <Card className="relative z-10 bg-transparent border-0 shadow-none">
          <CardContent className="p-6">
            <Header />
            
            <CreateButton onClick={showCreateForm} />
            
            {state.showForm && (
              <ICEForm
                onSubmit={handleCreate}
                onCancel={hideCreateForm}
                isLoading={addMutation.isPending}
              />
            )}
            
            <ICETable
              listaICE={listaICE}
              mieiVoti={mieiVoti}
              isLoading={isLoading}
              isError={isError}
              onEdit={startEdit}
              onDelete={handleDelete}
              deleteMutation={deleteMutation}
            />
          </CardContent>
        </Card>
      </div>
      
      <EditDialog
        ice={state.editICE}
        onClose={cancelEdit}
        onSubmit={handleUpdate}
        isLoading={editMutation.isPending}
      />
    </div>
  );
}
