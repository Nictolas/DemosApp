export interface Classifica {
  nome: string;
  voti: number;
}

export interface VotiData {
  classifiche: { [categoria: string]: Classifica[] };
  mieiVoti: { [categoria: string]: string };
  blocco: {
    isBlocked: boolean;
    unlockDate?: string;
  };
}

export interface Ministero {
  id: string;
  nome: string;
  categoria: string;
  icon: any;
  color: string;
  slug: string;
}

export interface GovernoState {
  selectedVoti: { [categoria: string]: string };
  showConfirmDialog: boolean;
  expandedCategories: { [categoria: string]: boolean };
}

export interface MinisteroCardProps {
  ministero: Ministero;
  data: VotiData | undefined;
  onNavigate: (ministero: Ministero) => void;
  onOpenModal: (ministero: Ministero) => void;
  isWide?: boolean;
}

export interface MinisteroModalProps {
  ministero: Ministero;
  data: VotiData | undefined;
  isOpen: boolean;
  onClose: () => void;
}

export interface HeaderProps {
  unlockDate: string | null;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export interface SaveButtonProps {
  isBlocked: boolean;
  votiCambiati: boolean;
  isPending: boolean;
  onSave: () => void;
}
