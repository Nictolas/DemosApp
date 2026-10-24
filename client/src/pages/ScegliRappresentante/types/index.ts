export interface Rappresentante {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  grado_elezione?: string;
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

export interface ScegliRappresentanteState {
  rappresentanti: Rappresentante[];
  loading: boolean;
  selezionando: boolean;
  rappresentanteSelezionato: string | null;
  opinioniDialogData: OpinioniDialogData | null;
}

export interface RappresentanteCardProps {
  rappresentante: Rappresentante;
  isSelected: boolean;
  isSelezionando: boolean;
  onSeleziona: (id: string) => void;
  onViewOpinioni: (data: OpinioniDialogData) => void;
}

export interface EmptyStateProps {
  isCandidate: boolean;
}

export interface HeaderProps {
  categoria: string;
  getTitolo: () => string;
}
