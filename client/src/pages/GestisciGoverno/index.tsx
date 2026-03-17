import { useMinisteriData } from "./hooks/useMinisteriData";
import { useMinisteriActions } from "./hooks/useMinisteriActions";
import { useMinisteriForms } from "./hooks/useMinisteriForms";
import { Header } from "./components/Header";
import { MinisteroForm } from "./components/MinisteroForm";
import { MinisteriTable } from "./components/MinisteriTable";
import { LoadingState } from "./components/LoadingState";

export default function GestisciGoverno() {
  // Data hooks
  const { data: ministeri = [], isLoading, isError } = useMinisteriData();
  
  // Action hooks
  const { addMutation, updateMutation, deleteMutation } = useMinisteriActions();
  
  // Form hooks
  const {
    form,
    setForm,
    editId,
    editForm,
    setEditForm,
    resetForm,
    resetEditForm,
    startEdit,
    validateForm,
    confirmDelete,
  } = useMinisteriForms();

  // Event handlers
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm(form)) {
      addMutation.mutate(form, {
        onSuccess: resetForm,
      });
    }
  };

  const handleSaveEdit = () => {
    if (validateForm(editForm)) {
      updateMutation.mutate(
        { id: editId!, data: editForm },
        { onSuccess: resetEditForm }
      );
    }
  };

  const handleDelete = (id: string) => {
    if (confirmDelete()) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-4xl">
        <Header />
        
        <MinisteroForm
          form={form}
          setForm={setForm}
          onSubmit={handleAdd}
          isLoading={addMutation.isPending}
        />
        
        <LoadingState isLoading={isLoading} isError={isError}>
          <MinisteriTable
            ministeri={ministeri}
            editId={editId}
            editForm={editForm}
            setEditForm={setEditForm}
            onStartEdit={startEdit}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={resetEditForm}
            onDelete={handleDelete}
            isUpdating={updateMutation.isPending}
            isDeleting={deleteMutation.isPending}
          />
        </LoadingState>
      </div>
    </div>
  );
}
