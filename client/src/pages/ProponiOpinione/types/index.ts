export interface OpinioneProposta {
  id: string;
  testo: string;
  voti: number;
  proponente: string;
  proponente_email?: string;
  data_creazione?: string;
  votanti: string[];
}

export interface ProponiOpinioneState {
  opinioni: OpinioneProposta[];
  loadingData: boolean;
  isVoting: boolean;
  testoInput: string;
  userVoti: string[];
  submitting: boolean;
  selectedVoti: string[];
  showConfirmDialog: boolean;
  isBlocked: boolean;
  unlockDate: Date | null;
  showClassifica: boolean;
  showAdDialog: boolean;
  showVideo: boolean;
  videoTimer: number;
}

export interface HeaderProps {
  // Nessuna prop necessaria per ora
}

export interface ProponiFormProps {
  testoInput: string;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onInputChange: (value: string) => void;
  opinioniEsistenti?: string[];
}

export interface OpinioniListProps {
  opinioni: OpinioneProposta[];
  userVoti: string[];
  isVoting: boolean;
  onVota: (id: string) => void;
  onRimuoviVoto: (id: string) => void;
  onCancella?: (id: string) => void;
  isAdmin?: boolean;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isVoting: boolean;
}

export interface AdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: () => void;
}

export interface VideoPlayerProps {
  open: boolean;
  timer: number;
  onComplete: () => void;
}
