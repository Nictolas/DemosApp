import { useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { AvatarEditor } from "@/components/AvatarEditor";
import { useToast } from "@/hooks/use-toast";
import { UserInfo } from "@/types/user";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AvatarConfig {
  skinColor: string;
  hairColor: string;
  hairStyle: string;
  mustacheStyle: string;
  mustacheColor: string;
  beardStyle: string;
  beardColor: string;
  noseStyle: string;
  suitColor: string;
  tieColor: string;
}

const defaultAvatarConfig: AvatarConfig = {
    skinColor: "#FDBCB4",
    hairColor: "#8B4513",
    hairStyle: "short",
    mustacheStyle: "none",
    mustacheColor: "#2C1810",
    beardStyle: "none",
    beardColor: "#2C1810",
    noseStyle: "normal",
    suitColor: "#2C3E50",
    tieColor: "#E74C3C"
};

export default function ModificaImmagine() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  // === DEBUG LOGS ===
  console.log('🔍 DEBUG ModificaImmagine - Componente montato');
  console.log('🔍 DEBUG ModificaImmagine - user from useAuth:', user);
  console.log('🔍 DEBUG ModificaImmagine - isAuthLoading:', isAuthLoading);
  console.log('🔍 DEBUG ModificaImmagine - user?.id:', user?.id);

  // 1. Caricamento dati con React Query
  const { data: userInfo, isLoading: isLoadingInfo } = useQuery<UserInfo>({
    queryKey: ['userInfo', user?.id],
    queryFn: async () => {
        console.log('🔍 DEBUG ModificaImmagine - queryFn eseguita');
        if (!user?.id) throw new Error("User not authenticated");
        console.log('🔍 DEBUG ModificaImmagine - Chiamando /api/users/me');
        const response = await apiRequest("GET", `/api/users/me`);
        console.log('🔍 DEBUG ModificaImmagine - Risposta API:', response.status, response.ok);
        if (!response.ok) throw new Error("Errore nel caricamento dei dati del profilo");
        const result = await response.json();
        console.log('🔍 DEBUG ModificaImmagine - Dati ricevuti:', result);
        return result.user || result;
    },
    enabled: !!user,
  });

  // === DEBUG LOGS ===
  console.log('🔍 DEBUG ModificaImmagine - userInfo from useQuery:', userInfo);
  console.log('🔍 DEBUG ModificaImmagine - isLoadingInfo:', isLoadingInfo);

  // 2. Mutazione per salvare l'avatar
  const saveAvatarMutation = useMutation({
    mutationFn: async (config: AvatarConfig) => {
        if (!user?.id) throw new Error("User not authenticated");
        const response = await apiRequest("POST", `/api/users/me/avatar`, {
            avatar_config: JSON.stringify(config),
        });
        if (!response.ok) throw new Error("Errore nel salvataggio dell'avatar");
        return response.json();
    },
    onSuccess: () => {
        toast({ title: "Avatar salvato", description: "Il tuo avatar è stato aggiornato con successo." });
        setTimeout(() => window.location.href = "/menu/profilo", 1000);
    },
    onError: (error: any) => {
        toast({ title: "Errore", description: error.message || "Impossibile salvare l'avatar.", variant: "destructive" });
    },
  });

  if (isAuthLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!user) {
    return <Redirect to="/auth" />;
  }

  const hasPermission = userInfo?.ruolo === 'Politico' || userInfo?.ruolo === 'Candidato' || userInfo?.ruolo === 'Candidato Politico' || userInfo?.ruolo === 'Admin';
  
  // === DEBUG LOGS ===
  console.log('🔍 DEBUG ModificaImmagine - hasPermission:', hasPermission);
  console.log('🔍 DEBUG ModificaImmagine - userInfo?.ruolo:', userInfo?.ruolo);
  console.log('🔍 DEBUG ModificaImmagine - Condizione redirect:', !isLoadingInfo && !hasPermission);
  
  if (!isLoadingInfo && !hasPermission) {
      console.log('🔍 DEBUG ModificaImmagine - REDIRECT A /menu/profilo!');
      console.log('🔍 DEBUG ModificaImmagine - Motivo: isLoadingInfo =', isLoadingInfo, 'hasPermission =', hasPermission);
      return <Redirect to="/menu/profilo" />;
  }
  
  // Parsa la configurazione dell'avatar solo una volta
  const initialAvatarConfig = (() => {
      if (!userInfo?.avatar_config) return defaultAvatarConfig;
      try {
          const config = JSON.parse(userInfo.avatar_config);
          return { ...defaultAvatarConfig, ...config };
      } catch {
          return defaultAvatarConfig;
      }
  })();
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      {isLoadingInfo ? (
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="container mx-auto max-w-7xl">
          <Button variant="ghost" className="mb-4 flex items-center" onClick={() => window.location.href = "/menu/profilo"}>
            <ArrowLeft className="mr-2 h-4 w-4" />Torna al Profilo
          </Button>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Modifica il Tuo Avatar</CardTitle>
              <CardDescription>Personalizza il tuo avatar per rappresentarti al meglio.</CardDescription>
            </CardHeader>
          </Card>
          
          <AvatarEditor 
            onSave={(config) => saveAvatarMutation.mutate(config)}
            initialConfig={initialAvatarConfig}
            isSaving={saveAvatarMutation.isPending}
          />
        </div>
      )}
    </div>
  );
}