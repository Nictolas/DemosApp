import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api-config";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export const apiRequest = async (method: string, url: string, body?: any) => {
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Usa token JWT dal localStorage invece di Firebase
  const token = localStorage.getItem('auth_token');
  console.log('🔍 DEBUG apiRequest - Token presente:', !!token);
  console.log('🔍 DEBUG apiRequest - Token value:', token ? token.substring(0, 20) + '...' : 'NULL');
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const finalUrl = getApiUrl(url);
  console.log('🔍 DEBUG apiRequest - Final URL:', finalUrl);
  console.log('🔍 DEBUG apiRequest - Headers:', headers);
  
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
    console.log('🔍 DEBUG getQueryFn - Token presente:', !!token);
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const finalUrl = getApiUrl(queryKey[0] as string);
    console.log('🔍 DEBUG getQueryFn - Final URL:', finalUrl);
    
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
