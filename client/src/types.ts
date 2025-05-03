export interface UserInfo {
  id?: string;
  nome: string;
  cognome: string;
  data_nascita: string;
  genere: string;
  cittadinanza: string;
  
  paese_residenza: string;
  regione_residenza: string;
  provincia_residenza: string;
  comune_residenza: string;
  
  paese_elezione?: string;
  regione_elezione?: string;
  provincia_elezione?: string;
  comune_elezione?: string;
  
  paese_candidatura?: string;
  regione_candidatura?: string;
  provincia_candidatura?: string;
  comune_candidatura?: string;
  
  ruolo: string;
  grado_elezione?: string;
  grado_candidatura?: string;
}

export interface LocationData {
  [country: string]: {
    regioni: Region[];
  };
}

export interface Region {
  nome: string;
  province: Province[];
}

export interface Province {
  nome: string;
  comuni: string[];
}
