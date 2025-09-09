import { useState } from "react";
import { useLocation } from "wouter";
import { OpinioniDialogData, ProgrammaDialogData } from "../types";

export const useCandidatiActions = () => {
  const [, setLocation] = useLocation();
  const [opinioniDialogData, setOpinioniDialogData] = useState<OpinioniDialogData | null>(null);
  const [programmaDialogData, setProgrammaDialogData] = useState<ProgrammaDialogData | null>(null);

  const handleNavigateToSelection = (categoriaId: string) => {
    setLocation(`/candidati/${categoriaId}`);
  };

  const handleOpenOpinioniDialog = (utenteId: string, nome: string, cognome: string, avatarConfig?: string, categoria?: string) => {
    setOpinioniDialogData({ utenteId, nome, cognome, avatarConfig, categoria });
  };

  const handleCloseOpinioniDialog = () => {
    setOpinioniDialogData(null);
  };

  const handleOpenProgrammaDialog = (utenteId: string, nome: string, cognome: string, avatarConfig?: string, categoria?: string) => {
    setProgrammaDialogData({ utenteId, nome, cognome, avatarConfig, categoria });
  };

  const handleCloseProgrammaDialog = () => {
    setProgrammaDialogData(null);
  };

  return {
    opinioniDialogData,
    programmaDialogData,
    handleNavigateToSelection,
    handleOpenOpinioniDialog,
    handleCloseOpinioniDialog,
    handleOpenProgrammaDialog,
    handleCloseProgrammaDialog
  };
};
