export interface Candidato {
  nome: string;
  cognome: string;
  avatar_config?: string;
}

export interface Categoria {
  id: string;
  nome: string;
  field: string;
  color: string;
  tipoElezione: string;
}

export interface Elezione {
  tipo: string;
  dataInizio: string;
  dataFine: string;
  circa?: boolean;
}

export interface UserData {
  [key: string]: any;
}

export interface OpinioniDialogData {
  utenteId: string;
  nome: string;
  cognome: string;
  avatarConfig?: string;
}

export interface ProgrammaDialogData {
  utenteId: string;
  nome: string;
  cognome: string;
  avatarConfig?: string;
}

export interface ElezioniData {
  utente: UserData;
  elezioni: Elezione[];
  candidati: Record<string, Candidato>;
}
