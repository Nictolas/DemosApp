import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api-config";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const apiRequestFunction = async (method: string, url: string, body?: any, customHeaders?: Record<string, string>) => {
  console.log('🔍 DEBUG apiRequest - Inizio richiesta:', { method, url, body });
  
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Usa token JWT dal localStorage invece di Firebase
  const token = localStorage.getItem('auth_token');
  console.log('🔍 DEBUG apiRequest - Token presente:', !!token);
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Aggiungi headers personalizzati se forniti
  if (customHeaders) {
    headers = { ...headers, ...customHeaders };
  }
  
  const finalUrl = getApiUrl(url);
  console.log('🔍 DEBUG apiRequest - URL finale:', finalUrl);
  console.log('🔍 DEBUG apiRequest - Headers:', headers);
  
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
    
    console.log('🔍 DEBUG apiRequest - Risposta ricevuta:', { status: response.status, ok: response.ok, url: response.url });
    
    // Verifica se la risposta è ok prima di restituirla
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
        console.error('❌ DEBUG apiRequest - Errore nella risposta:', errorData);
      } catch (e) {
        const text = await response.text();
        console.error('❌ DEBUG apiRequest - Errore (non JSON):', text);
        errorMessage = text || errorMessage;
      }
      throw new Error(errorMessage);
    }
    
    // Leggi il body come testo prima di parsarlo, per gestire meglio il caso 304
    const text = await response.text();
    
    // Se il body è vuoto (può succedere con 304), gestiscilo
    if (!text || text.trim() === '') {
      console.warn('⚠️ DEBUG apiRequest - Risposta con body vuoto, status:', response.status);
      throw new Error('Risposta vuota dal server');
    }
    
    // Prova a parsare il JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('❌ DEBUG apiRequest - Errore nel parsing JSON:', parseError);
      console.error('❌ DEBUG apiRequest - Testo ricevuto:', text);
      throw new Error('Errore nel parsing della risposta JSON');
    }
    
    console.log('🔍 DEBUG apiRequest - Dati ricevuti:', data);
    return data;
  } catch (error) {
    console.error('❌ DEBUG apiRequest - ERRORE:', error);
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
