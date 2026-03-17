export interface Ministero {
  id: string;
  nome: string;
  categoria: string;
  descrizione?: string;
}

export interface MinisteroFormData {
  nome: string;
  categoria: string;
  descrizione: string;
}

export interface MinisteroCreateData extends Omit<Ministero, 'id'> {}

export interface MinisteroUpdateData extends Omit<Ministero, 'id'> {}
