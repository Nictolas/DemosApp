export interface IniziativaPopolare {
  id: string;
  nome: string;
  descrizione: string;
  quorum: string;
  sitoWeb?: string;
  dataInizio?: string;
  dataFine?: string;
  data_fine?: string;
  data_creazione: string;
  votiices?: number;
  firme?: number;
  firme_raccolte?: number;
  esito?: string;
  status?: string;
  quorum_raggiunto?: boolean;
  emoji?: string;
  id_ministero?: string | number;
}

export interface IniziativaFormData {
  nome: string;
  descrizione: string;
  dataInizio: string;
  dataFine: string;
  sitoWeb: string;
}

export interface IniziativaState {
  showForm: boolean;
  editIniziativa: IniziativaPopolare | null;
  viewIniziativa: IniziativaPopolare | null;
}

export interface IniziativaFormProps {
  onSubmit: (data: IniziativaFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
  defaultValues?: IniziativaFormData;
}

export interface EditDialogProps {
  iniziativa: IniziativaPopolare | null;
  onClose: () => void;
  onSubmit: (data: IniziativaFormData & { quorum?: string }) => void;
  isLoading: boolean;
}

export interface ViewDialogProps {
  iniziativa: IniziativaPopolare | null;
  onClose: () => void;
  onEdit?: (iniziativa: IniziativaPopolare) => void;
  onDelete?: (id: string) => void;
  deleteMutation?: any;
}

export interface IniziativeTableProps {
  listaIniziative: IniziativaPopolare[];
  mieiVoti: string[];
  isLoading: boolean;
  isError: boolean;
  onView?: (iniziativa: IniziativaPopolare) => void;
}
