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
import { useNoScroll } from "@/hooks/useNoScroll";

interface Notifica {
  id: string;
  titolo: string;
  messaggio: string;
  tipo: string;
  utente_id: string;
  status: string;
  created_at: string;
  data_creazione?: string;
  data_lettura?: string;
  priorita?: string;
}

interface NotificheData {
  success: boolean;
  notifiche: Notifica[];
}

export default function Notifiche() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const { token: fcmToken, error: fcmError, permission } = useFCM();
  const queryClient = useQueryClient();
  
  // Blocca lo scroll della pagina
  useNoScroll(true);

  const [skipConfirm, setSkipConfirm] = useState(() => localStorage.getItem("skipLikeDislikeConfirm") === "true");
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; notificaId: string | null; action: string | null; }>({ open: false, notificaId: null, action: null });

  // Caricamento notifiche
  const { data, isLoading, error } = useQuery<NotificheData>({
    queryKey: ['notifiche'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/notifiche");
      if (!response.ok) throw new Error("Errore nel caricamento delle notifiche.");
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 60000, // Ricarica i dati ogni minuto
  });

  // Mutazione per segnare notifica come letta
  const markAsReadMutation = useMutation({
    mutationFn: async (notificaId: string) => {
      const response = await apiRequest("PUT", `/api/notifiche/${notificaId}/read`);
      if (!response.ok) throw new Error("Errore nell'aggiornamento notifica.");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifiche'] });
      toast({ title: "Notifica segnata come letta" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Mutazione per preferenze notifiche
  const prefsMutation = useMutation({
    mutationFn: (newPrefs: Record<string, boolean>) => 
      apiRequest("POST", "/api/notifiche/preferenze", { preferenze: newPrefs }),
    onSuccess: () => toast({ title: "Preferenze salvate" }),
    onError: () => toast({ 
      title: "Errore", 
      description: "Impossibile salvare le preferenze.", 
      variant: "destructive" 
    }),
  });

  const handleMarkAsRead = (notificaId: string) => {
    markAsReadMutation.mutate(notificaId);
  };

  const handleSwitch = (key: string, value: boolean) => {
    const currentPrefs = { tutte: true, email: true, push: true };
    const newPrefs = { ...currentPrefs, [key]: value };
    prefsMutation.mutate(newPrefs);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true, locale: it });
    } catch {
      return 'Data non disponibile';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'letta': return 'bg-green-100 text-green-800';
      case 'non_letta': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'letta': return 'Letta';
      case 'non_letta': return 'Non letta';
      default: return 'Sconosciuto';
    }
  };
  
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 page-with-navbar">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Bell className="h-8 w-8 text-blue-600" />
              Notifiche
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Gestisci le tue notifiche e preferenze
          </p>
        </div>

        {/* Preferenze Notifiche */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Preferenze Notifiche
            </CardTitle>
            <CardDescription>
              Configura come vuoi ricevere le notifiche
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wifi className="h-5 w-5 text-blue-600" />
                <span>Notifiche in-app</span>
              </div>
              <Switch
                checked={true}
                onCheckedChange={(checked) => handleSwitch('app', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-green-600" />
                <span>Notifiche push</span>
                {fcmError && (
                  <Badge variant="destructive" className="text-xs">
                    Errore
                  </Badge>
                )}
              </div>
              <Switch
                checked={permission === 'granted'}
                onCheckedChange={(checked) => handleSwitch('push', checked)}
                disabled={permission !== 'granted'}
              />
            </div>

            {fcmError && (
              <Alert variant="destructive">
                <AlertDescription>
                  Errore nelle notifiche push: {fcmError}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Lista Notifiche */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Le tue Notifiche
            </CardTitle>
            <CardDescription>
              {data?.notifiche?.length || 0} notifiche totali
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Errore nel caricamento delle notifiche: {error.message}
                </AlertDescription>
              </Alert>
            ) : !data?.notifiche || data.notifiche.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Nessuna notifica disponibile</p>
                <p className="text-sm">Le tue notifiche appariranno qui</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.notifiche.map((notifica) => (
                  <div
                    key={notifica.id}
                    className={`p-4 rounded-lg border ${
                      notifica.status === 'non_letta' 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">
                            {notifica.titolo || 'Notifica'}
                          </h3>
                          <Badge className={getStatusColor(notifica.status)}>
                            {getStatusText(notifica.status)}
                          </Badge>
                          {notifica.priorita && (
                            <Badge variant="outline">
                              {notifica.priorita}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-gray-700 mb-3">
                          {notifica.messaggio || 'Nessun messaggio disponibile'}
                        </p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>Tipo: {notifica.tipo || 'Generico'}</span>
                          <span>
                            {formatDate(notifica.created_at || notifica.data_creazione || '')}
                          </span>
                        </div>
                      </div>
                      
                      {notifica.status === 'non_letta' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsRead(notifica.id)}
                          disabled={markAsReadMutation.isPending}
                        >
                          {markAsReadMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Segna come letta'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog di conferma */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma azione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler procedere con questa azione?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction>
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
