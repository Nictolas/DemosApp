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
  title: string;
  categoria: string;
  icon: any;
  color: string;
}

export interface GovernoState {
  selectedVoti: { [categoria: string]: string };
  showConfirmDialog: boolean;
  expandedCategories: { [categoria: string]: boolean };
}

export interface MinisteroCardProps {
  ministero: Ministero;
  selectedVoti: { [categoria: string]: string };
  expandedCategories: { [categoria: string]: boolean };
  data: VotiData | undefined;
  onVotoChange: (categoria: string, nome: string) => void;
  onVotoRemove: (categoria: string) => void;
  onToggleExpansion: (categoria: string) => void;
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
