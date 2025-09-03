import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Ministero, MinisteroFormData } from "../types";
import { TOAST_MESSAGES } from "../constants";

export function useMinisteriForms() {
  const { toast } = useToast();
  
  const [form, setForm] = useState<MinisteroFormData>({ 
    nome: '', 
    categoria: '', 
    descrizione: '' 
  });
  
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MinisteroFormData>({ 
    nome: '', 
    categoria: '', 
    descrizione: '' 
  });

  const resetForm = () => {
    setForm({ nome: '', categoria: '', descrizione: '' });
  };

  const resetEditForm = () => {
    setEditId(null);
    setEditForm({ nome: '', categoria: '', descrizione: '' });
  };

  const startEdit = (ministero: Ministero) => {
    setEditId(ministero.id);
    setEditForm({
      nome: ministero.nome,
      categoria: ministero.categoria,
      descrizione: ministero.descrizione || '',
    });
  };

  const validateForm = (formData: MinisteroFormData): boolean => {
    if (!formData.nome.trim() || !formData.categoria.trim()) {
      toast({ 
        title: "Attenzione", 
        description: TOAST_MESSAGES.VALIDATION.REQUIRED_FIELDS, 
        variant: "destructive" 
      });
      return false;
    }
    return true;
  };

  const confirmDelete = (): boolean => {
    return confirm(TOAST_MESSAGES.CONFIRM.DELETE);
  };

  return {
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
  };
}
