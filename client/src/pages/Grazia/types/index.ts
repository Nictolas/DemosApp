export interface Classifica {
  nome: string;
  richieste: number;
}

export interface GraziaData {
  classifica: Classifica[];
  mieiVoti: string[];
  blocco: {
    isBlocked: boolean;
    unlockDate?: string;
  };
}

export interface GraziaVotingState {
  nomeInput: string;
  selectedVoti: string[];
  showConfirmDialog: boolean;
  showForm: boolean;
}

export interface GraziaVotingActions {
  onUpdateField: (field: keyof GraziaVotingState, value: string | string[] | boolean) => void;
  onShowForm: () => void;
  onHideForm: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onAddNomeLocal: (e: React.FormEvent) => void;
  onRemoveLocal: (nome: string) => void;
  onToggleSelezione: (nome: string) => void;
  onSaveVoti: () => void;
}

export interface CarceratoItemProps {
  item: Classifica;
  index: number;
  isSelected: boolean;
  isTopThree: boolean;
  onToggleSelezione: (nome: string) => void;
  disabled: boolean;
}
