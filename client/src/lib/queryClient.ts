import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api-config";
import { getAuthToken } from "@/lib/auth-token";
import { clearAllEncryptedProfiles, invalidateEncryptedProfileSections } from "@/pages/Profilo/utils/encryptedProfileVault";
import { clearAllProfileSummaries, clearProfileSummary } from "@/pages/Profilo/utils/profileSummaryCache";
import { profileMutationImpact, type ProfileCacheSection } from "@/lib/profileMutationPolicy";

const DEFAULT_REQUEST_TIMEOUT_MS = 12000;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const apiRequestFunction = async (method: string, url: string, body?: any, customHeaders?: Record<string, string>, externalSignal?: AbortSignal) => {
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Aggiungi headers personalizzati se forniti
  if (customHeaders) {
    headers = { ...headers, ...customHeaders };
  }
  
  // Verifica che url sia una stringa valida
  if (!url || typeof url !== 'string') {
    console.error('❌ apiRequest - URL non valido:', url);
    throw new Error(`URL non valido: ${url}`);
  }
  
  const finalUrl = getApiUrl(url);

  // Revocation cancels the real transport, not only the React Query cache.
  const controller = new AbortController();
  const abortFromQuery = () => controller.abort();
  if (externalSignal?.aborted) abortFromQuery();
  else externalSignal?.addEventListener("abort", abortFromQuery, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

  try {
    // Disabilita la cache per evitare problemi con status 304
    const fetchOptions: RequestInit = {
      method,
      headers: {
        ...headers,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    };
    
    const response = await fetch(finalUrl, { ...fetchOptions, signal: controller.signal });
    
    // Leggi il body come testo prima di parsarlo
    const text = await response.text();
    
    // Se il body è vuoto (può succedere con 304), gestiscilo
    if (!text || text.trim() === '') {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Risposta vuota dal server`);
      }
      throw new Error('Risposta vuota dal server');
    }
    
    // Prova a parsare il JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: risposta non valida dal server`);
      }
      throw new Error('Errore nel parsing della risposta JSON');
    }
    
    // Se la risposta non è ok, lancia un errore con il messaggio dall'API
    if (!response.ok) {
      const errorMessage = data.error || data.message || `HTTP ${response.status}`;
      const error = new Error(errorMessage) as any;
      error.status = response.status;
      error.ok = false;
      error.data = data;
      throw error;
    }
    
    // Only successful writes invalidate the section they changed; independent
    // sections remain available offline without new GETs after a reload.
    const ownerId = token
      ? queryClient.getQueryData<{ id?: string }>(["user", token])?.id
      : undefined;
    const impact = data?.success === false ? null : profileMutationImpact(method, url, ownerId);
    if (impact?.consent) {
      // Consent boundaries remain strict: never resurrect political answers.
      await clearAllEncryptedProfiles();
      queryClient.removeQueries({ queryKey: ["profilePolitical"] });
      queryClient.removeQueries({ queryKey: ["profileFull"] });
      queryClient.removeQueries({ queryKey: ["profileConsent"] });
    } else if (impact) {
      if (!ownerId) {
        // No verified account identity in RAM: fail closed, not cross-account.
        await clearAllEncryptedProfiles();
        queryClient.removeQueries({ queryKey: ["profilePolitical"] });
        queryClient.removeQueries({ queryKey: ["profileFull"] });
        if (impact.summary) {
          clearAllProfileSummaries();
          queryClient.removeQueries({ queryKey: ["profileSummary"] });
        }
      } else {
        // Revision guards stop a GET started before this write from putting
        // stale values back into the encrypted vault after invalidation.
        await invalidateEncryptedProfileSections(ownerId, impact.sections);
        const sections = new Set<ProfileCacheSection>(impact.sections);
        await queryClient.cancelQueries({
          predicate: query =>
            (query.queryKey[0] === "profilePolitical" &&
              query.queryKey[1] === ownerId &&
              sections.has(query.queryKey[3] as ProfileCacheSection)) ||
            (sections.has("full") && query.queryKey[0] === "profileFull" &&
              query.queryKey[1] === ownerId),
        });
        queryClient.removeQueries({
          queryKey: ["profilePolitical", ownerId],
          predicate: query => sections.has(query.queryKey[3] as ProfileCacheSection),
        });
        if (sections.has("full")) {
          queryClient.removeQueries({ queryKey: ["profileFull", ownerId] });
        }
        if (impact.summary) {
          clearProfileSummary(ownerId);
          queryClient.removeQueries({ queryKey: ["profileSummary", ownerId] });
          queryClient.removeQueries({ queryKey: ["desktop-user-avatar", ownerId] });
        }
      }
    }

    // Restituisci un oggetto Response-like per compatibilità
    return {
      ok: true,
      status: response.status,
      json: async () => data,
      data
    } as any;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      if (externalSignal?.aborted) throw error;
      throw new Error(`Timeout richiesta API (${DEFAULT_REQUEST_TIMEOUT_MS}ms): ${url}`);
    }
    // Se l'errore ha già status, rilancialo così com'è
    if (error.status !== undefined) {
      throw error;
    }
    // Altrimenti, crea un nuovo errore
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromQuery);
  }
};

// Wrapper per compatibilità con codice che usa apiRequest.get(), apiRequest.post(), ecc.
export const apiRequest = Object.assign(apiRequestFunction, {
  get: (url: string, options?: { params?: Record<string, any> }) => {
    let finalUrl = url;
    if (options?.params) {
      const params = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      const queryString = params.toString();
      if (queryString) {
        finalUrl = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
      }
    }
    return apiRequestFunction('GET', finalUrl);
  },
  post: (url: string, body?: any) => apiRequestFunction('POST', url, body),
  put: (url: string, body?: any) => apiRequestFunction('PUT', url, body),
  delete: (url: string) => apiRequestFunction('DELETE', url),
  patch: (url: string, body?: any) => apiRequestFunction('PATCH', url, body),
});

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const finalUrl = getApiUrl(queryKey[0] as string);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(finalUrl, { headers, signal: controller.signal });
    } catch (error: any) {
      if (error?.name === "AbortError") {
        throw new Error(`Timeout query API (${DEFAULT_REQUEST_TIMEOUT_MS}ms): ${String(queryKey[0])}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
