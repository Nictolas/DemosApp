export interface ICE {
  id: string;
  nome: string;
  descrizione: string;
  quorum: string;
  sitoWeb?: string;
  dataInizio?: string;
  dataFine?: string;
  data_creazione: string;
  votiIces?: number;
}

export interface ICEFormData {
  nome: string;
  descrizione: string;
  dataInizio: string;
  dataFine: string;
  siteWeb?: string;
}

export interface ICEData {
  success: boolean;
  richieste: ICE[];
  mieiVoti: string[];
  blocco: any;
}

export interface ICEState {
  showForm: boolean;
  editICE: ICE | null;
  viewICE?: ICE | null;
}

export interface ICETableProps {
  listaICE: ICE[];
  mieiVoti: string[];
  isLoading: boolean;
  isError: boolean;
  onView?: (ice: ICE) => void;
  onEdit: (ice: ICE) => void;
  onDelete: (id: string) => void;
  deleteMutation: any;
}

export interface ICEFormProps {
  onSubmit: (data: ICEFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
  defaultValues?: ICEFormData;
}

export interface EditDialogProps {
  ice: ICE | null;
  onClose: () => void;
  onSubmit: (data: ICEFormData) => void;
  isLoading: boolean;
}

export interface ViewDialogProps {
  ice: ICE | null;
  onClose: () => void;
}
