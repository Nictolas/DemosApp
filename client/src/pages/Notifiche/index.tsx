import React, { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useNotificheData } from "./hooks/useNotificheData";
import { Header } from "./components/Header";
import { ListaNotifiche } from "./components/ListaNotifiche";
import { LoadingStates } from "./components/LoadingStates";
import { PageContainer } from "@/components/PageContainer";

const REACTION_TIPI = ['voto_comune', 'voto_parlamento', 'comunicazione'] as const;

export default function Notifiche() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data, isLoading, error, deleteSegnalazioneMutation } = useNotificheData(user);

  const reactionIds = useMemo(() => {
    if (!data?.notifiche?.length || !user?.id) return [];
    return data.notifiche
      .filter((n) => REACTION_TIPI.includes(n.tipo_notifica as any))
      .map((n) => n.id)
      .filter(Boolean);
  }, [data?.notifiche, user?.id]);

  const idsQuery = reactionIds.length > 0 ? reactionIds.join(',') : '';

  const { data: reazioniBatch } = useQuery({
    queryKey: ['reazioni-batch', idsQuery],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reazioni-comunicazioni/batch?ids=${encodeURIComponent(idsQuery)}`);
      return (res?.data?.data ?? {}) as Record<string, { likes: number; dislikes: number }>;
    },
    enabled: !!idsQuery,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userReazioniBatch } = useQuery({
    queryKey: ['reazioni-user-batch', user?.id, idsQuery],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reazioni-comunicazioni/user/${user?.id}/batch?ids=${encodeURIComponent(idsQuery)}`);
      return (res?.data?.data ?? {}) as Record<string, string | null>;
    },
    enabled: !!user?.id && !!idsQuery,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full flex flex-col" style={{ minHeight: 'calc(100vh - 6rem - max(env(safe-area-inset-bottom), 56px))' }}>
        <LoadingStates isAuthLoading={isAuthLoading} />
        
        <div className="flex-shrink-0">
          <Header />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <ListaNotifiche
            data={data}
            isLoading={isLoading}
            error={error}
            deleteSegnalazioneMutation={deleteSegnalazioneMutation}
            reazioniMap={reazioniBatch}
            userReazioniMap={userReazioniBatch}
          />
        </div>
      </div>

    </PageContainer>
  );
}
