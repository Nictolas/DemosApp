/**
 * Utility per le richieste API
 */
import { Capacitor } from "@capacitor/core";
import { getAuthToken } from "@/lib/auth-token";

const CANONICAL_API_BASE_URL = 'https://api.demos.community/api';
const NATIVE_API_FALLBACK_URL = 'https://demos-c7k0.onrender.com/api';

const normalizeApiBaseUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

// Configurazione API coerente con api-config.ts anche per i vecchi consumer di ApiRequest.
// Web usa sempre il dominio canonico salvo override esplicito; il fallback Render resta
// confinato al client nativo fino alla qualificazione della prossima release Android.
const resolveBaseUrl = (): string => {
  const env = (import.meta as any).env || {};
  const configured = normalizeApiBaseUrl(env.VITE_API_BASE_URL || env.VITE_API_URL || '');

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '/api';
  }

  if (Capacitor.isNativePlatform()) {
    return configured || NATIVE_API_FALLBACK_URL;
  }

  return configured || CANONICAL_API_BASE_URL;
};

const API_BASE_URL = resolveBaseUrl();

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
    const token = getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
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
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
          message: errorData.message || 'Errore nella richiesta',
        };
      }

      const data = await response.json();
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
