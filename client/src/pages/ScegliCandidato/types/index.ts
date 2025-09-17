export interface Candidato {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  status: string;
  avatarConfig?: string;
  grado_candidatura?: string;
}

export interface OpinioniDialogData {
  utenteId: string;
  nome?: string;
  cognome?: string;
  avatarConfig?: string;
  categoria?: string;
}

export interface HeaderProps {
  categoria: string;
  getTitolo: () => string;
}

export interface EmptyStateProps {
  categoria: string;
  getTitolo: () => string;
}

export interface CandidatoCardProps {
  candidato: Candidato;
  isSelected: boolean;
  isSelezionando: boolean;
  onSeleziona: (id: string) => void;
  onViewOpinioni: (data: OpinioniDialogData) => void;
}
