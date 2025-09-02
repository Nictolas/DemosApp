import { useState } from "react";
import { OpinioniDialogData, ProgrammaDialogData } from "../types";

export const useElezioniActions = () => {
  const [opinioniDialogData, setOpinioniDialogData] = useState<OpinioniDialogData | null>(null);
  const [programmaDialogData, setProgrammaDialogData] = useState<ProgrammaDialogData | null>(null);

  const handleOpenOpinioniDialog = (utenteId: string, nome: string, cognome: string, avatarConfig?: string) => {
    setOpinioniDialogData({ utenteId, nome, cognome, avatarConfig });
  };

  const handleCloseOpinioniDialog = () => {
    setOpinioniDialogData(null);
  };

  const handleOpenProgrammaDialog = (utenteId: string, nome: string, cognome: string, avatarConfig?: string) => {
    setProgrammaDialogData({ utenteId, nome, cognome, avatarConfig });
  };

  const handleCloseProgrammaDialog = () => {
    setProgrammaDialogData(null);
  };

  return {
    opinioniDialogData,
    programmaDialogData,
    handleOpenOpinioniDialog,
    handleCloseOpinioniDialog,
    handleOpenProgrammaDialog,
    handleCloseProgrammaDialog
  };
};
