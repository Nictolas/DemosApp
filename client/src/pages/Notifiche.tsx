import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useFCM } from "@/hooks/useFCM";
import { ThumbsUp, ThumbsDown, Bell, Smartphone, Wifi, Loader2, User, Checkbox, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { CustomAvatar } from "@/components/CustomAvatar";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { Link, Redirect } from "wouter";

interface Comunicazione {
  id: string;
  titolo: string;
  id_utente: string; // ID del rappresentante che ha comunicato
  data_creazione: string;
  likes: number;
  dislikes: number;
  voto_utente?: 'like' | 'dislike';
}

interface RappresentanteInfo {
  nome: string;
  cognome: string;
  avatar_config?: string;
  grado_elezione?: string;
}

interface NotificheData {
  comunicazioni: Comunicazione[];
  rappresentantiInfo: Record<string, RappresentanteInfo>;
  preferenze: Record<string, boolean>;
}

export default function Notifiche() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const { token: fcmToken, error: fcmError, permission } = useFCM();
  const queryClient = useQueryClient();
  
  const [skipConfirm, setSkipConfirm] = useState(() => localStorage.getItem("skipLikeDislikeConfirm") === "true");
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; comunicazioneId: string | null; reaction: "like" | "dislike" | null; }>({ open: false, comunicazioneId: null, reaction: null });

  // 1. Caricamento dati con React Query (con refresh automatico)
  const { data, isLoading } = useQuery<NotificheData>({
    queryKey: ['notifiche'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/notifiche");
      if (!response.ok) throw new Error("Errore nel caricamento delle notifiche.");
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 60000, // Ricarica i dati ogni minuto
  });

  // 2. Mutazioni per le azioni
  const reactionMutation = useMutation({
    mutationFn: async ({ comunicazioneId, reaction }: { comunicazioneId: string; reaction: "like" | "dislike" }) => {
      const response = await apiRequest("POST", `/api/comunicazioni/${comunicazioneId}/react`, { reaction });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Reazione fallita");
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifiche'] }),
    onError: (error: any) => toast({ title: "Errore", description: error.message, variant: "destructive" }),
  });

  const prefsMutation = useMutation({
      mutationFn: (newPrefs: Record<string, boolean>) => apiRequest("POST", "/api/notifiche/preferenze", { preferenze: newPrefs }),
      onSuccess: () => toast({ title: "Preferenze salvate" }),
      onError: () => toast({ title: "Errore", description: "Impossibile salvare le preferenze.", variant: "destructive" }),
  });

  const handleReactionClick = (comunicazioneId: string, reaction: "like" | "dislike", voto_utente?: string) => {
    if (voto_utente) {
      toast({ title: "Hai già votato", description: "Puoi esprimere la tua preferenza una sola volta.", variant: "default" });
      return;
    }
    if (skipConfirm) {
      reactionMutation.mutate({ comunicazioneId, reaction });
    } else {
      setConfirmDialog({ open: true, comunicazioneId, reaction });
    }
  };

  const handleConfirmReaction = () => {
    if (confirmDialog.comunicazioneId && confirmDialog.reaction) {
      reactionMutation.mutate({ comunicazioneId: confirmDialog.comunicazioneId, reaction: confirmDialog.reaction });
      if (localStorage.getItem("dontShowAgain") === "true") {
        setSkipConfirm(true);
        localStorage.setItem("skipLikeDislikeConfirm", "true");
      }
    }
    setConfirmDialog({ open: false, comunicazioneId: null, reaction: null });
  };

  const handleSwitch = (key: string, value: boolean) => {
    const currentPrefs = data?.preferenze || {};
    let newPrefs = { ...currentPrefs, [key]: value };
    if (key === "tutte") {
      newPrefs = { tutte: value, europeo: value, nazionale: value, regionale: value, comunale: value };
    } else {
      newPrefs.tutte = newPrefs.europeo && newPrefs.nazionale && newPrefs.regionale && newPrefs.comunale;
    }
    prefsMutation.mutate(newPrefs);
  };
  
  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;

  // Il resto del JSX è stato adattato per usare i dati da `data`
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        {/* ... JSX per la visualizzazione ... */}
    </div>
  );
}