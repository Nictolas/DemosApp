import { useState } from "react";
import { useLocation } from "wouter";
import { OpinioniDialogData } from "../types";

export const useCandidatiActions = () => {
  const [, setLocation] = useLocation();
  const [opinioniDialogData, setOpinioniDialogData] = useState<OpinioniDialogData | null>(null);

  const handleNavigateToSelection = (categoriaId: string) => {
    setLocation(`/candidati/${categoriaId}`);
  };

  const handleOpenOpinioniDialog = (utenteId: string, nome: string, cognome: string, avatarConfig?: string, categoria?: string) => {
    setOpinioniDialogData({ utenteId, nome, cognome, avatarConfig, categoria });
  };

  const handleCloseOpinioniDialog = () => {
    setOpinioniDialogData(null);
  };

  return {
    opinioniDialogData,
    handleNavigateToSelection,
    handleOpenOpinioniDialog,
    handleCloseOpinioniDialog
  };
};
