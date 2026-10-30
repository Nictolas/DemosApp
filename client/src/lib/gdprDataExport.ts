import { getApiUrl } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-token';

export type GdprExportFormat = 'json' | 'csv';

// Use the same API origin and session-token resolver as other authenticated
// requests, including Capacitor. Never download a response into a new session.
export async function requestGdprExport(format: GdprExportFormat): Promise<Blob> {
  const token = getAuthToken();
  if (!token) throw new Error('Accedi nuovamente per esportare i dati.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(getApiUrl(`/api/user/data-export?format=${format}`), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Esportazione non disponibile. Riprova più tardi.');
    const contentType = response.headers.get('content-type') || '';
    let blob: Blob;
    if (format === 'csv') {
      if (!/^text\/csv(?:\s*;|$)/i.test(contentType)) throw new Error('Risposta CSV non valida.');
      const csv = await response.text();
      if (!csv.trim()) throw new Error('Risposta CSV vuota.');
      blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    } else {
      if (!/^application\/json(?:\s*;|$)/i.test(contentType)) throw new Error('Risposta JSON non valida.');
      const payload = await response.json();
      if (payload?.success !== true || !payload.data ||
          typeof payload.data !== 'object' || Array.isArray(payload.data)) {
        throw new Error('Esportazione non confermata dal server.');
      }
      blob = new Blob([JSON.stringify(payload.data, null, 2)], { type: 'application/json' });
    }
    if (getAuthToken() !== token) throw new Error('Sessione cambiata. Avvia nuovamente l’esportazione.');
    return blob;
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadGdprExport(format: GdprExportFormat): Promise<void> {
  const token = getAuthToken();
  const blob = await requestGdprExport(format);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  try {
    anchor.href = url;
    anchor.download = `dati-personali-${new Date().toISOString().split('T')[0]}.${format}`;
    if (!token || getAuthToken() !== token) throw new Error('Sessione cambiata. Avvia nuovamente l’esportazione.');
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
