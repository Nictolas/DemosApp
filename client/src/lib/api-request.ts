/**
 * Utility per le richieste API
 */

// Configurazione API che rispetta l'ambiente
const resolveBaseUrl = (): string => {
  // Controlla se siamo in produzione (Render)
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    console.log('🔍 DEBUG api-request.ts - Hostname:', window.location.hostname);
    console.log('🔍 DEBUG api-request.ts - URL completo:', window.location.href);
    return 'https://demos-c7k0.onrender.com/api';
  }

  // Sviluppo locale
  return 'http://localhost:3001/api';
};

const API_BASE_URL = import.meta.env.VITE_API_URL || resolveBaseUrl();

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface RequestOptions extends RequestInit {
  timeout?: number;
}

class ApiRequest {
  private baseURL: string;
  private defaultTimeout: number;

  constructor(baseURL: string = API_BASE_URL, defaultTimeout: number = 10000) {
    this.baseURL = baseURL;
    this.defaultTimeout = defaultTimeout;
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const timeout = options.timeout || this.defaultTimeout;

    // Aggiungi token di autenticazione se presente
    // Il token viene salvato come 'auth_token' nel localStorage
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
      console.log('🔍 DEBUG api-request - Token trovato e aggiunto all\'header');
    } else {
      console.log('⚠️ DEBUG api-request - Nessun token trovato nel localStorage');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ DEBUG api-request - Errore risposta:', response.status, errorData);
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
          message: errorData.message || 'Errore nella richiesta',
        };
      }

      const data = await response.json();
      console.log('✅ DEBUG api-request - Risposta ricevuta:', {
        status: response.status,
        success: data.success,
        message: data.message
      });
      return {
        success: true,
        data: data.data || data,
        ...data,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Timeout della richiesta',
            message: 'La richiesta ha impiegato troppo tempo',
          };
        }
        
        return {
          success: false,
          error: error.message,
          message: 'Errore di rete',
        };
      }

      return {
        success: false,
        error: 'Errore sconosciuto',
        message: 'Si è verificato un errore imprevisto',
      };
    }
  }

  async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    console.log('🔍 DEBUG ApiRequest.post - endpoint:', endpoint);
    console.log('🔍 DEBUG ApiRequest.post - data:', data);
    console.log('🔍 DEBUG ApiRequest.post - this.baseURL:', this.baseURL);
    const fullUrl = `${this.baseURL}${endpoint}`;
    console.log('🔍 DEBUG ApiRequest.post - URL completo:', fullUrl);
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T = any>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Istanza singleton
const apiRequest = new ApiRequest();

export default apiRequest;
export { ApiRequest, type ApiResponse, type RequestOptions };
