import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api-config";
import { getAuthToken } from "@/lib/auth-token";

const DEFAULT_REQUEST_TIMEOUT_MS = 12000;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const apiRequestFunction = async (method: string, url: string, body?: any, customHeaders?: Record<string, string>) => {
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
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
    const response = await fetch(finalUrl, { ...fetchOptions, signal: controller.signal }).finally(() => {
      clearTimeout(timeoutId);
    });
    
    // Leggi il body come testo prima di parsarlo
    const text = await response.text();
    
    // Log per debug
    if (url.includes('referendum-abrogativi') || url.includes('voti-parlamento-europeo')) {
      console.log('🔍 DEBUG apiRequest - URL:', url);
      console.log('🔍 DEBUG apiRequest - Response status:', response.status);
      console.log('🔍 DEBUG apiRequest - Response ok:', response.ok);
      console.log('🔍 DEBUG apiRequest - Text length:', text?.length);
      console.log('🔍 DEBUG apiRequest - Text preview (first 500 chars):', text?.substring(0, 500));
    }
    
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
      if (url.includes('referendum-abrogativi') || url.includes('voti-parlamento-europeo')) {
        console.log('🔍 DEBUG apiRequest - Parsed data:', JSON.stringify(data, null, 2));
        console.log('🔍 DEBUG apiRequest - data.success:', data?.success);
        if (url.includes('referendum-abrogativi')) {
          console.log('🔍 DEBUG apiRequest - data.referendum:', data?.referendum);
          console.log('🔍 DEBUG apiRequest - data.richieste:', data?.richieste);
        }
        if (url.includes('voti-parlamento-europeo')) {
          console.log('🔍 DEBUG apiRequest - data.data:', data?.data);
          console.log('🔍 DEBUG apiRequest - data.count:', data?.count);
        }
      }
    } catch (parseError) {
      if (url.includes('referendum-abrogativi') || url.includes('voti-parlamento-europeo')) {
        console.error('❌ DEBUG apiRequest - Parse error:', parseError);
        console.error('❌ DEBUG apiRequest - Text that failed to parse:', text);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
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
    
    // Invalida gli snapshot in memoria dopo scritture che cambiano profilo,
    // selezioni o consensi. Le chiamate GET non causano altre letture.
    const profileWriteRoots = [
      "users", "user", "opinioni", "governo", "rappresentanti",
      "candidati", "attivismo-tipologie", "consenso", "consensi", "privacy",
    ];
    const apiPath = url.startsWith("/api/") ? url.slice(5).split("?")[0] : "";
    if (
      method.toUpperCase() !== "GET" &&
      data?.success !== false &&
      profileWriteRoots.some((root) => apiPath === root || apiPath.startsWith(root + "/"))
    ) {
      void queryClient.invalidateQueries({ queryKey: ["profileSnapshot"] });
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
      throw new Error(`Timeout richiesta API (${DEFAULT_REQUEST_TIMEOUT_MS}ms): ${url}`);
    }
    // Se l'errore ha già status, rilancialo così com'è
    if (error.status !== undefined) {
      throw error;
    }
    // Altrimenti, crea un nuovo errore
    throw error;
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
