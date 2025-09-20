import { useState } from "react";
import { useLocation } from "wouter";
import { OpinioniDialogData } from "../types";

export const useTestActions = () => {
  const [, setLocation] = useLocation();
  const [opinioniDialogData, setOpinioniDialogData] = useState<OpinioniDialogData | null>(null);

  const handleNavigateToSelection = (categoriaId: string) => {
    // Per le pagine di candidati, usa sempre /candidati/:categoria
    setLocation(`/candidati/${categoriaId}`);
  };

  const handleOpenOpinioniDialog = (utenteId: string, nome: string, cognome: string, avatarConfig?: string, categoria?: string) => {
    setOpinioniDialogData({ utenteId, nome, cognome, avatarConfig, categoria });
  };

  const handleCloseOpinioniDialog = () => {
    setOpinioniDialogData(null);
  };

  const navigateWithButtonReset = (path: string) => {
    setLocation(path);
  };

  return {
    opinioniDialogData,
    handleNavigateToSelection,
    handleOpenOpinioniDialog,
    handleCloseOpinioniDialog,
    navigateWithButtonReset
  };
};
