export interface Notifica {
  id: string;
  titolo: string;
  messaggio: string;
  tipo: string;
  utente_id: string;
  status: string;
  created_at: string;
  data_creazione?: string;
  data_lettura?: string;
  priorita?: string;
  // Nuove proprietà per comunicazioni
  tipo_notifica?: 'notifica' | 'comunicazione' | 'voto_comune' | 'demos' | 'comunale' | 'segnalazione_problema' | 'avvistamento';
  autore?: {
    nome: string;
    cognome: string;
    ruolo: string;
  };
  voto?: string;
  data?: string;
  comune_residenza?: string;
  politico?: string;
  politico_avatar_config?: any;
  politico_nome?: string;
  politico_cognome?: string;
  tipo_avvistamento?: string; // Per notifiche avvistamenti
  likes?: number;
  dislikes?: number;
  tabella_origine?: string;
  // Proprietà per segnalazioni
  tipo_segnalazione?: string;
  passaggi?: string;
  comportamento_atteso?: string;
  comportamento_effettivo?: string;
  browser?: string;
  dispositivo?: string;
}

export interface NotificheData {
  success: boolean;
  notifiche: Notifica[];
}

export interface NotifichePrefs {
  tutte: boolean;
  email: boolean;
  push: boolean;
}

export interface ConfirmDialogState {
  open: boolean;
  notificaId: string | null;
  action: string | null;
}

export interface NotificaItemProps {
  notifica: Notifica;
  deleteSegnalazioneMutation?: any;
}

export interface PreferenzeNotificheProps {
  fcmToken: string | null;
  fcmError: string | null;
  permission: string;
  onSwitch: (key: string, value: boolean) => void;
}

export interface PreferenzeRappresentanti {
  eurodeputato: boolean;
  senatore: boolean;
  deputato: boolean;
  consigliere_regionale: boolean;
  consigliere_comunale: boolean;
  attivisti: boolean;
  demos: boolean;
}