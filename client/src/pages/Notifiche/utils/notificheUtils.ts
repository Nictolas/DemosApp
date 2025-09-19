import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true, locale: it });
  } catch {
    return 'Data non disponibile';
  }
};


export const getNotificaBackground = (status: string): string => {
  if (status === 'non_letta') {
    return 'bg-blue-50 border-blue-200';
  }
  return 'bg-white border-gray-200';
};

export const getNotificaTitle = (titolo?: string): string => {
  return titolo || 'Notifica';
};

export const getNotificaMessage = (messaggio?: string): string => {
  return messaggio || 'Nessun messaggio disponibile';
};

export const getNotificaType = (tipo?: string): string => {
  return tipo || 'Generico';
};
