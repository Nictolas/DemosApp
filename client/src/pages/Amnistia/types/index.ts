export interface Classifica {
  legge: string;
  voti: number;
}

export interface AmnistiaData {
  classifica: Classifica[];
  mieiVoti: string[];
}

export interface AmnistiaVotingState {
  leggeInput: string;
  showSuggestions: boolean;
  showAllClassifica: boolean;
  showForm: boolean;
}

export interface AmnistiaVotingActions {
  onUpdateField: (field: keyof AmnistiaVotingState, value: string | boolean) => void;
  onShowSuggestions: () => void;
  onHideSuggestions: () => void;
  onShowClassifica: () => void;
  onSelectSuggestion: (legge: string) => void;
}

export interface LeggeItemProps {
  item: Classifica;
  index: number;
  isTopThree: boolean;
  onVote: (legge: string) => void;
  isPending: boolean;
  hasReachedLimit: boolean;
}

export interface AmnistiaFormProps {
  leggeInput: string;
  showSuggestions: boolean;
  mieiVoti: string[];
  suggestions: Classifica[];
  isPending: boolean;
  onUpdateField: (field: string, value: string | boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onRemoveVote: (legge: string) => void;
  onSelectSuggestion: (legge: string) => void;
  onShowSuggestions: () => void;
  onHideSuggestions: () => void;
  hasReachedLimit: boolean;
}
