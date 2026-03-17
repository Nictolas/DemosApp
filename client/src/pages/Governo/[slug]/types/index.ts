export interface Classifica {
  nome: string;
  voti: number;
}

export interface MinisteroData {
  classifiche: Classifica[];
  mieiVoti: string[];
  blocco: {
    isBlocked: boolean;
    unlockDate?: string;
  };
}

export interface MinisteroVotingState {
  nomeInput: string;
  selectedVoti: string[];
  showConfirmDialog: boolean;
  showAllClassifica: boolean;
  showSuggestions: boolean;
}

export interface HeaderProps {
  ministero: {
    id: string;
    nome: string;
    categoria: string;
    icon: any;
    color: string;
    slug: string;
  };
  unlockDate?: string;
}

export interface TopTenProps {
  classifiche: Classifica[];
  selectedVoti: string[];
  onToggleSelezione: (nome: string) => void;
  showAllClassifica: boolean;
}

export interface VotingFormProps {
  votingState: MinisteroVotingState;
  data: MinisteroData | undefined;
  onUpdateField: (field: keyof MinisteroVotingState, value: string | string[] | boolean) => void;
  onAddNome: (e: React.FormEvent) => void;
  onRemove: (nome: string) => void;
  onShowForm: () => void;
  onSaveVoti: () => void;
  isAdmin?: boolean;
}
