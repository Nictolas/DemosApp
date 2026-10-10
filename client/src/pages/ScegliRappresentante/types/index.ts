export interface Rappresentante {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  grado_elezione?: string;
  matching_score?: number;
  compatibilita_percentuale?: number;
  compatibilitaPercentuale?: number;
  copertura_posizioni?: number;
  coperturaPosizioni?: number;
  copertura_totale?: number;
  coperturaTotale?: number;
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
  categoria: string;
  getTitolo: () => string;
}

export interface HeaderProps {
  categoria: string;
  getTitolo: () => string;
}
