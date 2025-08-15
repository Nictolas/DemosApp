import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { auth } from "@/lib/firebase-stub";

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
  // DEBUG: logga lo stato di auth.currentUser
  console.log("[apiRequest] DEBUG: auth.currentUser:", auth.currentUser);
  // Aggiungi token Firebase se presente
  const user = auth.currentUser;
  if (user) {
    const idToken = await user.getIdToken();
    console.log("[apiRequest] DEBUG: TOKEN JWT:", idToken);
    headers['Authorization'] = `Bearer ${idToken}`;
  } else {
    console.warn("[apiRequest] DEBUG: Nessun utente Firebase loggato, Authorization non aggiunto");
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
    // DEBUG: logga lo stato di auth.currentUser
    console.log("[getQueryFn] auth.currentUser:", auth.currentUser);
    // Recupera token Firebase se presente
    const user = auth.currentUser;
    if (user) {
      const idToken = await user.getIdToken();
      console.log("[getQueryFn] TOKEN JWT:", idToken);
      headers['Authorization'] = `Bearer ${idToken}`;
    } else {
      console.warn("[getQueryFn] Nessun utente Firebase loggato, Authorization non aggiunto");
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
