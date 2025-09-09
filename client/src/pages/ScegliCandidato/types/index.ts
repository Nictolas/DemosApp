export interface Candidato {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  grado_candidatura?: string;
  opinioni_comuni: number;
  avatar_config?: string;
  energia_nucleare?: string;
  sperimentazione_animale?: string;
  legalizzazione_canapa?: string;
  caccia?: string;
  paese_elezione?: string;
  regione_elezione?: string;
  provincia_elezione?: string;
  comune_elezione?: string;
}

export interface OpinioniDialogData {
  utenteId: string;
  nome: string;
  cognome: string;
  avatarConfig?: string;
}

export interface CandidatoCardProps {
  candidato: Candidato;
  isSelected: boolean;
  isSelezionando: boolean;
  onSeleziona: (candidatoId: string) => void;
  onViewOpinioni: (data: OpinioniDialogData) => void;
}

export interface HeaderProps {
  categoria: string;
  getTitolo: () => string;
}

export interface EmptyStateProps {
  categoria: string;
  getTitolo: () => string;
}