import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { formatNotificationDate } from '@/utils/dateUtils';
import { sanitizeRichHtml } from '@/lib/sanitize-html';

export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true, locale: it });
  } catch {
    return 'Data non disponibile';
  }
};

// Nuova funzione che usa il fuso orario italiano
export const formatDateItalian = (dateString: string): string => {
  return formatNotificationDate(dateString);
};


export const getNotificaBackground = (status: string): string => {
  if (status === 'non_letta') {
    return 'bg-blue-50 border-blue-200';
  }
  return 'bg-white border-gray-200';
};

export const getNotificaTitle = (titolo?: string): string => {
  return sanitizeRichHtml(titolo || 'Notifica');
};

export const getNotificaMessage = (messaggio?: string): string => {
  return sanitizeRichHtml(messaggio || '');
};

