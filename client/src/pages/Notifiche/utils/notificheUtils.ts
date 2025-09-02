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

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'letta': return 'bg-green-100 text-green-800';
    case 'non_letta': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusText = (status: string): string => {
  switch (status) {
    case 'letta': return 'Letta';
    case 'non_letta': return 'Non letta';
    default: return 'Sconosciuto';
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
