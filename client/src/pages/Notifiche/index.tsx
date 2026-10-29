import React, { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
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
    <PageContainer className="notifiche-page overflow-hidden bg-gradient-to-b from-slate-50 via-blue-50/60 to-slate-50">
      <div className="flex h-full min-h-0 w-full flex-col">
        <LoadingStates isAuthLoading={isAuthLoading} />

        <Header total={data?.notifiche?.length ?? 0} isLoading={isLoading} />

        <div
          className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-4 sm:px-6 sm:pb-6"
          role="region"
          aria-label="Elenco notifiche"
          tabIndex={0}
        >
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
