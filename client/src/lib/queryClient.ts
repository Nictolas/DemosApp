import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { API_CONFIG } from "@/lib/api-config";
// Firebase rimosso - ora usiamo JWT da localStorage
// import { auth } from "@/lib/firebase-stub";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const resolveApiUrl = (input: string): string => {
  if (/^https?:\/\//i.test(input)) return input;
  
  // Usa la stessa logica di getApiUrl
  const baseUrl = (() => {
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return 'https://demos-c7k0.onrender.com/api';
    }
         return 'http://localhost:3001/api';
  })();
  
  if (input.startsWith('/api/')) return `${baseUrl}${input.substring(4)}`;
  if (input.startsWith('/')) return `${baseUrl}${input}`;
  return `${baseUrl}/${input}`;
};

export const apiRequest = async (method: string, url: string, body?: any) => {
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Usa token JWT dal localStorage invece di Firebase
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const finalUrl = resolveApiUrl(url);
  return fetch(finalUrl, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
};

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
    
    const finalUrl = resolveApiUrl(queryKey[0] as string);
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
