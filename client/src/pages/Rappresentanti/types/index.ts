export interface RappresentanteInfo {
  nome: string;
  cognome: string;
  avatar_config?: string;
}

export interface RappresentantiData {
  rappresentanti: Record<string, RappresentanteInfo>; // Es: { europeo: {...}, camera: {...} }
  idMap: Record<string, string>; // Es: { europeo: 'uid123', camera: 'uid456' }
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
