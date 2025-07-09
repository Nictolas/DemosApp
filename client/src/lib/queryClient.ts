import { QueryClient, QueryFunction } from "@tanstack/react-query";

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
  // Aggiungi token Firebase se presente
  if (typeof window !== 'undefined' && (window as any).firebase) {
    try {
      const user = (window as any).firebase.auth().currentUser;
      if (user) {
        const idToken = await user.getIdToken();
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    } catch (e) {}
  }
  return fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // credentials: 'include', // Non serve più per Firebase Auth
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
    // Recupera token Firebase se presente
    if (typeof window !== 'undefined' && (window as any).firebase) {
      try {
        const user = (window as any).firebase.auth().currentUser;
        if (user) {
          const idToken = await user.getIdToken();
          headers['Authorization'] = `Bearer ${idToken}`;
        }
      } catch (e) {}
    }
    const res = await fetch(queryKey[0] as string, {
      headers,
      // credentials: 'include', // Non serve più per Firebase Auth
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
