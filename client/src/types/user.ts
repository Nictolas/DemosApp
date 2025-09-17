// Definizione dei ruoli utente disponibili
export type UserRole = 
  | "Admin" 
  | "Politico" 
  | "Candidato Politico" 
  | "Istituzione" 
  | "Cittadino" 
  | "Rappresentante";

// Definizione condivisa del tipo UserInfo
export type UserInfo = {
  id?: string;
  nome: string;
  cognome: string;
  data_nascita: string;
  genere: string;
  cittadinanza: string;
  ruolo: UserRole;
  paese_residenza: string;
  regione_residenza: string;
  provincia_residenza: string;
  comune_residenza: string;
  paese_elezione?: string;
  regione_elezione?: string;
  provincia_elezione?: string;
  comune_elezione?: string;
  grado_elezione?: string;
  paese_candidatura?: string;
  regione_candidatura?: string;
  provincia_candidatura?: string;
  comune_candidatura?: string;
  grado_candidatura?: string;
  energia_nucleare?: string;
  sperimentazione_animale?: string;
  legalizzazione_canapa?: string;
  caccia?: string;
  avatar_config?: string;
  status?: string;
  [key: string]: any;
}; 
