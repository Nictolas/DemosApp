export interface CandidatoInfo {
  nome: string;
  cognome: string;
  avatar_config?: string;
}

export interface ElezioniData {
  candidati: Record<string, CandidatoInfo>; // Es: { europeo: {...}, camera: {...} }
  idMap: Record<string, string>; // Es: { europeo: 'uid123', camera: 'uid456' }
  // Legacy support
  candidatiPerCategoria?: Record<string, any[]>; // Es: { europeo: [...], camera: [...] }
  utente?: Record<string, string | null>; // Es: { candidato_europeo: 'uid123', candidato_camera: 'uid456' }
  candidatiPerGrado?: Record<string, any[]>; // Es: { Europeo: [...], Camera: [...] }
  selectedEuropeanCandidateId?: string | null;
}

export interface Categoria {
  id: string;
  nome: string;
  color: string;
}

export interface OpinioniDialogData {
  utenteId: string;
  nome: string;
  cognome: string;
  avatarConfig?: string;
  categoria?: string;
}
