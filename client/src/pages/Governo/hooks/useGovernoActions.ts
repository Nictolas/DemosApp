import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { VotiData, GovernoState } from "../types";

export const useGovernoActions = (data: VotiData | undefined) => {
  const { toast } = useToast();
  
  const [governoState, setGovernoState] = useState<GovernoState>({
    selectedVoti: {},
    showConfirmDialog: false,
    expandedCategories: {}
  });

  // Effect per aggiornare selectedVoti quando i dati arrivano
  useEffect(() => {
    if (data?.mieiVoti) {
      setGovernoState(prev => ({
        ...prev,
        selectedVoti: data.mieiVoti
      }));
    }
  }, [data]);

  const handleChangeMinistro = (categoria: string, nome: string) => {
    if (data?.blocco.isBlocked) return;
    setGovernoState(prev => ({
      ...prev,
      selectedVoti: { ...prev.selectedVoti, [categoria]: nome.trim() }
    }));
  };

  const handleRemoveVoto = (categoria: string) => {
    if (data?.blocco.isBlocked) return;
    const newVoti = { ...governoState.selectedVoti };
    delete newVoti[categoria];
    setGovernoState(prev => ({
      ...prev,
      selectedVoti: newVoti
    }));
  };

  const handleSalvaVoti = () => {
    if (data?.blocco.isBlocked) {
      toast({ title: "Bloccato", description: "Puoi modificare i voti solo una volta a settimana.", variant: "destructive" });
      return;
    }
    setGovernoState(prev => ({
      ...prev,
      showConfirmDialog: true
    }));
  };

  const toggleCategoryExpansion = (categoria: string) => {
    setGovernoState(prev => ({
      ...prev,
      expandedCategories: {
        ...prev.expandedCategories,
        [categoria]: !prev.expandedCategories[categoria]
      }
    }));
  };

  const closeConfirmDialog = () => {
    setGovernoState(prev => ({
      ...prev,
      showConfirmDialog: false
    }));
  };

  const getVotiCambiati = () => {
    return JSON.stringify(governoState.selectedVoti) !== JSON.stringify(data?.mieiVoti || {});
  };

  return {
    governoState,
    handleChangeMinistro,
    handleRemoveVoto,
    handleSalvaVoti,
    toggleCategoryExpansion,
    closeConfirmDialog,
    getVotiCambiati
  };
};
