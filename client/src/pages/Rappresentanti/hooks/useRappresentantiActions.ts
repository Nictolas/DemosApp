import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { OpinioniDialogData } from "../types";

export const useRappresentantiActions = () => {
  const [, setLocation] = useLocation();
  const [match] = useRoute("/candidati*");
  const [opinioniDialogData, setOpinioniDialogData] = useState<OpinioniDialogData | null>(null);

  const handleNavigateToSelection = (categoriaId: string) => {
    // Se siamo nella route /candidati*, usa /candidati/:categoria, altrimenti usa /scegli-rappresentante/:categoria
    const basePath = match ? "/candidati" : "/scegli-rappresentante";
    setLocation(`${basePath}/${categoriaId}`);
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
