export interface ICE {
  id: string;
  nome: string;
  descrizione?: string | null;
  firme: number;
  signature_count?: number;
  slug?: string | null;
  dataFine?: string | null;
  datafine?: string | null;
  sitoWeb?: string | null;
  sitoweb?: string | null;
  status?: string | null;
  source?: string | null;
}

export interface ICEData {
  success: boolean;
  source?: string;
  ordering?: string;
  richieste: ICE[];
}

export interface ICETableProps {
  listaICE: ICE[];
  isLoading: boolean;
  isError: boolean;
}
