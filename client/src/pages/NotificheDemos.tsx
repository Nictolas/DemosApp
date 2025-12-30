import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, ArrowLeft, Loader2, Send, TestTube, AlertCircle, User } from "lucide-react";
import { UserAutocomplete } from "@/components/UserAutocomplete";

const demosNotificationSchema = z.object({
  titolo: z.string().min(1, "Il titolo è obbligatorio"),
  commento: z.string().min(1, "Il commento è obbligatorio"),
});

const userNotificationSchema = z.object({
  userId: z.string().min(1, "Seleziona un utente"),
  titolo: z.string().min(1, "Il titolo è obbligatorio"),
  messaggio: z.string().min(1, "Il messaggio è obbligatorio"),
});

type DemosNotificationFormData = z.infer<typeof demosNotificationSchema>;
type UserNotificationFormData = z.infer<typeof userNotificationSchema>;

export default function NotificheDemos() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Verifica lo stato delle preferenze dell'utente corrente
  const { data: debugData, isLoading: isLoadingDebug } = useQuery({
    queryKey: ['/api/comunicazioni/debug-notifiche-demos', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await apiRequest("GET", "/api/comunicazioni/debug-notifiche-demos");
      if (!response.ok) {
        throw new Error('Errore nel recupero dello stato');
      }
      return response.json();
    },
    enabled: !!user?.id,
    retry: false,
  });

  const demosForm = useForm<DemosNotificationFormData>({
    resolver: zodResolver(demosNotificationSchema),
    defaultValues: {
      titolo: "",
      commento: "",
    },
  });

  const [selectedUser, setSelectedUser] = useState<{ id: string; displayName: string } | null>(null);
  const [userSearchValue, setUserSearchValue] = useState("");

  const userNotificationForm = useForm<UserNotificationFormData>({
    resolver: zodResolver(userNotificationSchema),
    defaultValues: {
      userId: "",
      titolo: "",
      messaggio: "",
    },
  });

  // Mutazione per testare le notifiche push
  const testPushNotification = useMutation({
    mutationFn: async () => {
      const testData = {
        titolo: "Notifica di Test",
        messaggio: "Questa è una notifica di test per verificare il funzionamento delle notifiche push. Se ricevi questa notifica, significa che le tue preferenze sono configurate correttamente!"
      };
      
      console.log('🔵 FRONTEND: Invio richiesta POST /api/comunicazioni/send-demos-notification');
      console.log('🔵 FRONTEND: Dati:', testData);
      console.log('🔵 FRONTEND: Token presente:', !!localStorage.getItem('auth_token'));
      
      // Importa getApiUrl per vedere l'URL completo
      const { getApiUrl } = await import("@/lib/api-config");
      const fullUrl = getApiUrl("/api/comunicazioni/send-demos-notification");
      console.log('🔵 FRONTEND: URL completo:', fullUrl);
      
      const response = await apiRequest("POST", "/api/comunicazioni/send-demos-notification", testData);
      
      console.log('🔵 FRONTEND: Risposta ricevuta, status:', response.status, 'ok:', response.ok);
      const responseData = await response.json().catch(() => ({}));
      console.log('🔵 FRONTEND: Response body:', JSON.stringify(responseData));
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Errore nell'invio della notifica di test");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      const stats = data.data?.statistiche;
      const message = stats 
        ? `Notifica inviata a ${stats.utenti_idonei} utente/i (${stats.utenti_con_demos_attivo} con preferenze attive, ${stats.utenti_con_fcm_tokens} con token FCM)`
        : "La notifica di test è stata inviata a tutti gli utenti con le preferenze 'Demos' attivate.";
      
      toast({ 
        title: "Notifica di test inviata", 
        description: message,
        duration: 5000
      });
      console.log('🔄 Invalidando notificationBadge dopo invio notifica di test');
      queryClient.invalidateQueries({ queryKey: ['notificationBadge'] });
    },
    onError: (error: any) => {
      console.error("Errore nell'invio notifica di test:", error);
      toast({ 
        title: "Errore", 
        description: error.message || "Invio fallito. Riprova più tardi.", 
        variant: "destructive" 
      });
    },
  });

  // Mutazione per inviare notifica a un utente specifico
  const submitUserNotification = useMutation({
    mutationFn: async (data: UserNotificationFormData) => {
      if (!data.userId) {
        throw new Error('Seleziona un utente');
      }
      
      const response = await apiRequest("POST", "/api/comunicazioni/send-user-notification", {
        userId: data.userId,
        titolo: data.titolo,
        messaggio: data.messaggio,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Errore nell'invio della notifica");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      const destinatario = data.data?.destinatario;
      const message = destinatario 
        ? `Notifica inviata con successo a ${destinatario.nome} ${destinatario.cognome}`
        : "Notifica inviata con successo";
      
      toast({ 
        title: "Notifica inviata", 
        description: message,
        duration: 5000
      });
      userNotificationForm.reset();
      setSelectedUser(null);
      setUserSearchValue("");
      queryClient.invalidateQueries({ queryKey: ['notificationBadge'] });
    },
    onError: (error: any) => {
      console.error("Errore nell'invio notifica utente:", error);
      toast({ 
        title: "Errore", 
        description: error.message || "Invio fallito. Riprova più tardi.", 
        variant: "destructive" 
      });
    },
  });

  // Mutazione per le notifiche di Demos
  const submitDemosNotification = useMutation({
    mutationFn: async (data: DemosNotificationFormData) => {
      if (!user?.id) {
        throw new Error('ID utente non disponibile. Riprova tra qualche secondo.');
      }
      
      const comunicazioneData = {
        titolo: data.titolo,
        commento: data.commento,
        zona: "Generale",
        id_utente: user.id,
        tipo: "demos_notification"
      };
      
      const response = await apiRequest("POST", "/api/comunicazioni", comunicazioneData);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Errore nell'invio della notifica");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Notifica inviata", 
        description: "La notifica di Demos è stata inviata a tutti gli utenti con le preferenze attivate." 
      });
      demosForm.reset();
      console.log('🔄 Invalidando notificationBadge dopo invio notifica Demos');
      queryClient.invalidateQueries({ queryKey: ['notificationBadge'] });
    },
    onError: (error: any) => {
      console.error("Errore nell'invio notifica Demos:", error);
      toast({ 
        title: "Errore", 
        description: error.message || "Invio fallito. Riprova più tardi.", 
        variant: "destructive" 
      });
    },
  });

  if (isAuthLoading) {
    return (
      <PageContainer className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Verifica che l'utente sia admin
  const userRole = user?.ruolo;
  const isAdmin = userRole === "AD";

  if (!isAdmin) {
    return (
      <PageContainer className="flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            Accesso negato. Questa sezione è accessibile solo agli amministratori.
          </AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonna principale */}
          <div className="lg:col-span-2 space-y-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/gestisci")}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Bell className="h-8 w-8 text-blue-600" />
              Notifiche Demos
            </h1>
            <p className="text-gray-600 mt-1">
              Invia notifiche push a tutti gli utenti con le preferenze "Demos" attivate
            </p>
          </div>
        </div>

        {/* Pulsante Test Notifica */}
        <Card className="bg-white shadow-sm mb-4">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TestTube className="h-5 w-5 text-emerald-600" />
              Test Notifiche Push
            </CardTitle>
            <CardDescription>
              Invia una notifica di test a tutti gli utenti con le preferenze "Demos" attivate per verificare il funzionamento delle notifiche push.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Mostra stato utente corrente */}
            {!isLoadingDebug && debugData?.data && (
              <Alert 
                variant={debugData.data.preferenze.ricevera_notifiche ? "default" : "destructive"}
                className="mb-4"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Il tuo stato:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Preferenza "Demos": {debugData.data.preferenze.demos_attivo ? "✅ Attiva" : "❌ Non attiva"}</li>
                    <li>Token FCM: {debugData.data.preferenze.ha_fcm_tokens ? `✅ Presente (${debugData.data.preferenze.numero_token_fcm})` : "❌ Non presente"}</li>
                    <li>Riceverai notifiche: {debugData.data.preferenze.ricevera_notifiche ? "✅ Sì" : "❌ No"}</li>
                  </ul>
                  {debugData.data.preferenze.demos_status && (
                    <div className="mt-2 text-xs text-gray-600">
                      <strong>Debug:</strong> demos_value={String(debugData.data.preferenze.demos_value)}, 
                      demos_type={debugData.data.preferenze.demos_type}, 
                      status={debugData.data.preferenze.demos_status}
                      {debugData.data.statistiche_globali && (
                        <>
                          <br />
                          <strong>Globali:</strong> {debugData.data.statistiche_globali.totale_utenti_fcm} utenti con FCM, 
                          {debugData.data.statistiche_globali.utenti_demos_true} con demos=true, 
                          {debugData.data.statistiche_globali.utenti_demos_false} con demos=false, 
                          {debugData.data.statistiche_globali.utenti_demos_null} con demos=NULL
                        </>
                      )}
                    </div>
                  )}
                  {!debugData.data.preferenze.ricevera_notifiche && (
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation("/notifiche/preferenze")}
                        className="mt-2"
                      >
                        Attiva Preferenze "Demos"
                      </Button>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => testPushNotification.mutate()}
              disabled={testPushNotification.isPending}
            >
              {testPushNotification.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Invio test in corso...
                </>
              ) : (
                <>
                  <TestTube className="mr-2 h-4 w-4" />
                  Invia Notifica di Test
                </>
              )}
            </Button>
            <Alert className="mt-4">
              <Bell className="h-4 w-4" />
              <AlertDescription>
                <strong>Nota:</strong> La notifica di test verrà inviata solo agli utenti che hanno attivato 
                le notifiche "Demos" nelle loro preferenze e che hanno un token FCM valido.
                <br />
                <br />
                <strong>Se non ricevi la notifica:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>Verifica di aver attivato le notifiche "Demos" in <a href="/notifiche/preferenze" className="text-blue-600 underline">Preferenze Notifiche</a></li>
                  <li>Assicurati di aver concesso i permessi per le notifiche push nel browser/app</li>
                  <li>Controlla che il dispositivo sia connesso a internet</li>
                  <li>Verifica che l'app sia aperta o in background (non chiusa completamente)</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Form */}
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Nuova Notifica Demos
            </CardTitle>
            <CardDescription>
              La notifica verrà inviata a tutti gli utenti che hanno attivato le notifiche "Demos" nelle loro preferenze.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...demosForm}>
              <form 
                onSubmit={demosForm.handleSubmit((data) => submitDemosNotification.mutate(data))} 
                className="space-y-6"
              >
                <FormField
                  control={demosForm.control}
                  name="titolo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titolo della notifica *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Es: Aggiornamento importante, Partecipa al sondaggio..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={demosForm.control}
                  name="commento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Messaggio *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Inserisci il messaggio completo per tutti gli utenti..."
                          rows={6}
                          className="resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Alert>
                  <Bell className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Nota:</strong> La notifica verrà inviata solo agli utenti che hanno attivato 
                    le notifiche "Demos" nelle loro preferenze. Se una notifica Demos esiste già, verrà 
                    sovrascritta con questa nuova.
                  </AlertDescription>
                </Alert>

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={submitDemosNotification.isPending}
                >
                  {submitDemosNotification.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Invio in corso...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Invia Notifica a Tutti
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
          </div>

          {/* Sezione laterale - Notifica a utente specifico */}
          <div className="lg:col-span-1">
            <Card className="bg-white shadow-sm sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <User className="h-5 w-5 text-purple-600" />
                  Notifica a Utente
                </CardTitle>
                <CardDescription>
                  Invia una notifica push a un utente specifico selezionato dalla tabella users.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...userNotificationForm}>
                  <form 
                    onSubmit={userNotificationForm.handleSubmit((data) => submitUserNotification.mutate(data))} 
                    className="space-y-4"
                  >
                    <FormField
                      control={userNotificationForm.control}
                      name="userId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Seleziona Utente *</FormLabel>
                          <FormControl>
                            <UserAutocomplete
                              value={userSearchValue}
                              onChange={(value) => {
                                setUserSearchValue(value);
                                if (!selectedUser) {
                                  field.onChange("");
                                }
                              }}
                              onUserSelect={(user) => {
                                setSelectedUser({ id: user.id, displayName: user.displayName });
                                field.onChange(user.id);
                                setUserSearchValue(user.displayName);
                              }}
                              placeholder="Cerca utente per nome o email..."
                              className="w-full"
                            />
                          </FormControl>
                          {selectedUser && (
                            <p className="text-sm text-gray-600 mt-1">
                              Selezionato: <strong>{selectedUser.displayName}</strong>
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={userNotificationForm.control}
                      name="titolo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Titolo *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Titolo della notifica"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={userNotificationForm.control}
                      name="messaggio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Messaggio *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Messaggio della notifica"
                              rows={4}
                              className="resize-y"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Alert>
                      <Bell className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        La notifica verrà inviata solo se l'utente ha token FCM registrati.
                      </AlertDescription>
                    </Alert>

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={submitUserNotification.isPending || !selectedUser}
                    >
                      {submitUserNotification.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Invio in corso...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Invia Notifica
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}


