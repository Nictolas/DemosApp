import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api-config";

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
  
  // Usa token JWT dal localStorage invece di Firebase
  const token = localStorage.getItem('auth_token');
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Aggiungi headers personalizzati se forniti
  if (customHeaders) {
    headers = { ...headers, ...customHeaders };
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
    
    const response = await fetch(finalUrl, fetchOptions);
    
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
    } catch (parseError) {
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
    
    // Restituisci un oggetto Response-like per compatibilità
    return {
      ok: true,
      status: response.status,
      json: async () => data,
      data
    } as any;
  } catch (error: any) {
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
    
    // Usa token JWT dal localStorage invece di Firebase
    const token = localStorage.getItem('auth_token');
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const finalUrl = getApiUrl(queryKey[0] as string);
    
    const res = await fetch(finalUrl, {
      headers,
    });

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
