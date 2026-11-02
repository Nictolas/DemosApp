import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
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

  // Verifica che l'utente sia admin (prima delle query che lo usano)
  const userRole = user?.ruolo;
  const isAdmin = userRole === "AD";
  // The debug GET may send a test FCM push; never call it on page mount.
  // Backend debug APIs exist only under explicit opt-in local development.
  const localDiagnosticsEnabled = import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_NOTIFICATION_DIAGNOSTICS === "true";

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
    enabled: localDiagnosticsEnabled && !!user?.id && isAdmin,
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

  // Preserve the same client-generated UUID after a timeout/network error.
  // A new composition or a successful reply starts a new explicit send.
  const pendingUserSend = useRef<{ signature: string; key: string } | null>(null);
  const pendingSelfTestKey = useRef<string | null>(null);
  const getUserSendKey = (signature: string) => {
    if (pendingUserSend.current?.signature !== signature) {
      pendingUserSend.current = { signature, key: crypto.randomUUID() };
    }
    return pendingUserSend.current.key;
  };

  // Mutazione per testare le notifiche push
  const testPushNotification = useMutation({
    mutationFn: async () => {
      const testData = {
        titolo: "Notifica di Test",
        messaggio: "Questa è una notifica di test per verificare il funzionamento delle notifiche push. Se ricevi questa notifica, significa che le tue preferenze sono configurate correttamente!"
      };
      
      const response = await apiRequest("POST", "/api/comunicazioni/send-demos-notification", testData);
      // Consume the response body once: a second response.json() throws after the first read.
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseData.error || "Errore nell'invio della notifica di test");
      }
      return responseData;
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

  // Query per debug Firebase Admin - auto-verifica all'apertura della pagina
  const { data: firebaseDebugData, refetch: refetchFirebaseDebug, isLoading: isLoadingFirebaseDebug } = useQuery({
    queryKey: ['/api/comunicazioni/debug-firebase-admin'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/comunicazioni/debug-firebase-admin");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore nel recupero dello stato Firebase Admin');
      }
      return response.json();
    },
    enabled: false, // Explicit local click only; debug GET can send a real FCM push
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Test diretto: invia notifica a se stesso
  const testSelfNotification = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('Utente non autenticato');
      }
      
      const response = await apiRequest("POST", "/api/comunicazioni/send-user-notification", {
        userId: user.id,
        titolo: "Test Firebase Admin",
        messaggio: "Questa è una notifica di test per verificare che Firebase Admin funzioni correttamente.",
        idempotencyKey: pendingSelfTestKey.current ?? (pendingSelfTestKey.current = crypto.randomUUID())
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Errore nell'invio della notifica di test");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      pendingSelfTestKey.current = null;
      const pushSent = data.data?.push_inviato === true;
      toast({
        title: pushSent ? "Test push riuscito" : "Test push non riuscito",
        description: data.message || (pushSent
          ? "Firebase ha accettato la notifica di test."
          : "La notifica è stata salvata nell'app, ma il push non è stato inviato."),
        variant: pushSent ? "default" : "destructive",
        duration: 5000
      });
      queryClient.invalidateQueries({ queryKey: ['notificationBadge'] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Test fallito",
        description: error.message || "Invio fallito. Verifica la configurazione di Firebase Admin.",
        variant: "destructive",
        duration: 8000
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
        idempotencyKey: getUserSendKey(JSON.stringify([data.userId, data.titolo, data.messaggio])),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Errore nell'invio della notifica");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      pendingUserSend.current = null;
      const pushSent = data.data?.push_inviato === true;
      toast({
        title: pushSent ? "Notifica salvata e push inviato" : "Notifica salvata nell'app",
        description: data.message || "La notifica è disponibile nell'app.",
        duration: 5000
      });
      userNotificationForm.reset();
      setSelectedUser(null);
      setUserSearchValue("");
      queryClient.invalidateQueries({ queryKey: ['notificationBadge'] });
    },
    onError: (error: any) => {
      console.error("Errore nell'invio notifica utente:", error);
      
      // Estrai dettagli aggiuntivi dall'errore se disponibili
      let errorMessage = error.message || "Invio fallito. Riprova più tardi.";
      let errorDetails = null;
      
      if (error.response?.data || error.data) {
        const errorData = error.response?.data || error.data;
        if (errorData.data?.firebase_admin_configurato === false) {
          errorMessage = "Firebase Admin non configurato. Verifica le variabili d'ambiente.";
        }
        if (errorData.data?.notifiche_fallite !== undefined) {
          errorDetails = `Tentativi: ${errorData.data.notifiche_inviate + errorData.data.notifiche_fallite}, Successi: ${errorData.data.notifiche_inviate}, Fallimenti: ${errorData.data.notifiche_fallite}`;
        }
      }
      
      toast({ 
        title: "Errore", 
        description: errorDetails ? `${errorMessage}\n${errorDetails}` : errorMessage, 
        variant: "destructive",
        duration: 8000
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
      
      // Estrai dettagli aggiuntivi dall'errore se disponibili
      let errorMessage = error.message || "Invio fallito. Riprova più tardi.";
      
      if (error.response?.data || error.data) {
        const errorData = error.response?.data || error.data;
        if (errorData.details) {
          errorMessage = `${errorMessage}\nDettagli: ${errorData.details}`;
        }
      }
      
      toast({ 
        title: "Errore", 
        description: errorMessage, 
        variant: "destructive",
        duration: 8000
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
      <div className="max-w-[1800px] mx-auto">
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

        {/* Grid orizzontale per le sezioni */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Sezione 1: Diagnostica Firebase Admin */}
          <div className="flex flex-col">
            <Card className="bg-white shadow-sm border-2 border-purple-300 h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-purple-600" />
              Diagnostica Firebase Admin
            </CardTitle>
            <CardDescription>
              Verifica la configurazione di Firebase Admin e diagnostica eventuali problemi
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 overflow-y-auto">
            {!localDiagnosticsEnabled && (
              <Alert>
                <AlertDescription>Diagnostica avanzata disponibile solo nello sviluppo locale autorizzato. Il test individuale può essere avviato manualmente.</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => refetchFirebaseDebug()}
                disabled={!localDiagnosticsEnabled || isLoadingFirebaseDebug}
              >
                {isLoadingFirebaseDebug ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifica...
                  </>
                ) : (
                  <>
                    <TestTube className="mr-2 h-4 w-4" />
                    Ricarica Stato
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="default"
                className="flex-1"
                onClick={() => testSelfNotification.mutate()}
                disabled={testSelfNotification.isPending}
              >
                {testSelfNotification.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Invio test...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Test Invio
                  </>
                )}
              </Button>
            </div>
            
            {isLoadingFirebaseDebug && (
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-purple-600" />
                <p className="text-sm text-gray-600 mt-2">Verifica configurazione in corso...</p>
              </div>
            )}
            
            {firebaseDebugData?.data && (
              <div className="space-y-3">
                {/* Stato generale */}
                <Alert variant={firebaseDebugData.data.stato_inizializzazione.admin_disponibile ? "default" : "destructive"}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">
                        {firebaseDebugData.data.stato_inizializzazione.admin_disponibile ? "✅" : "❌"}
                      </span>
                      <div>
                        <div className="font-semibold text-base">
                          {firebaseDebugData.data.stato_inizializzazione.admin_disponibile 
                            ? "Firebase Admin Configurato e Funzionante" 
                            : "Firebase Admin Non Configurato"}
                        </div>
                        {firebaseDebugData.data.stato_inizializzazione.admin_disponibile ? (
                          <div className="text-sm text-green-700 mt-1">
                            Puoi inviare notifiche push. Usa il pulsante "Test Invio" per verificare.
                          </div>
                        ) : (
                          <div className="text-sm mt-1">
                            <strong>Problema rilevato:</strong> Firebase Admin non può essere inizializzato. Verifica le variabili d'ambiente su Render.com.
                          </div>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Variabili d'ambiente */}
                <div className="bg-gray-50 p-3 rounded">
                  <div className="font-semibold mb-2 text-sm">Variabili d'ambiente:</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={firebaseDebugData.data.environment.FIREBASE_PROJECT_ID.presente ? "text-green-600" : "text-red-600"}>
                        {firebaseDebugData.data.environment.FIREBASE_PROJECT_ID.presente ? "✅" : "❌"}
                      </span>
                      <span className="font-mono">FIREBASE_PROJECT_ID:</span>
                      <span className={firebaseDebugData.data.environment.FIREBASE_PROJECT_ID.presente ? "text-green-600" : "text-red-600"}>
                        {firebaseDebugData.data.environment.FIREBASE_PROJECT_ID.presente 
                          ? `Presente (${firebaseDebugData.data.environment.FIREBASE_PROJECT_ID.valore})` 
                          : "Mancante"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={firebaseDebugData.data.environment.FIREBASE_CLIENT_EMAIL.presente ? "text-green-600" : "text-red-600"}>
                        {firebaseDebugData.data.environment.FIREBASE_CLIENT_EMAIL.presente ? "✅" : "❌"}
                      </span>
                      <span className="font-mono">FIREBASE_CLIENT_EMAIL:</span>
                      <span className={firebaseDebugData.data.environment.FIREBASE_CLIENT_EMAIL.presente ? "text-green-600" : "text-red-600"}>
                        {firebaseDebugData.data.environment.FIREBASE_CLIENT_EMAIL.presente 
                          ? `Presente (${firebaseDebugData.data.environment.FIREBASE_CLIENT_EMAIL.valore})` 
                          : "Mancante"}
                      </span>
                      {firebaseDebugData.data.environment.FIREBASE_CLIENT_EMAIL.presente && 
                       firebaseDebugData.data.environment.FIREBASE_CLIENT_EMAIL.valore_completo && (
                        <div className="text-xs text-gray-600 mt-1">
                          Email completa: <code className="bg-gray-100 px-1 rounded">{firebaseDebugData.data.environment.FIREBASE_CLIENT_EMAIL.valore_completo}</code>
                        </div>
                      )}
                      {firebaseDebugData.data.environment.FIREBASE_CLIENT_EMAIL.presente && 
                       firebaseDebugData.data.environment.FIREBASE_CLIENT_EMAIL.formato_corretto === false && (
                        <span className="text-red-600 font-semibold text-xs ml-2">
                          ⚠️ Formato non valido (deve contenere @ e firebase-adminsdk)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.presente ? "text-green-600" : "text-red-600"}>
                        {firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.presente ? "✅" : "❌"}
                      </span>
                      <span className="font-mono">FIREBASE_PRIVATE_KEY:</span>
                      <span className={firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.presente ? "text-green-600" : "text-red-600"}>
                        {firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.presente 
                          ? `Presente (${firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.lunghezza} caratteri)` 
                          : "Mancante"}
                      </span>
                      {firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.presente && 
                       firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.lunghezza < 1000 && (
                        <span className="text-red-600 font-semibold text-xs">
                          ⚠️ TROPPO CORTA! (dovrebbe essere ~1600+ caratteri)
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.presente && (
                    <div className="mt-3 pt-3 border-t border-gray-300 text-xs">
                      <div className="font-semibold mb-1">Analisi chiave privata:</div>
                      <div className="space-y-1">
                        <div>Inizia con: <code className="bg-gray-200 px-1 rounded">{firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.inizia_con || 'N/A'}</code></div>
                        <div>Finisce con: <code className="bg-gray-200 px-1 rounded">{firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.finisce_con || 'N/A'}</code></div>
                        <div className="flex items-center gap-2">
                          <span className={firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.contiene_begin ? "text-green-600" : "text-red-600"}>
                            {firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.contiene_begin ? "✅" : "❌"}
                          </span>
                          <span>Contiene "BEGIN PRIVATE KEY"</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.contiene_end ? "text-green-600" : "text-red-600"}>
                            {firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.contiene_end ? "✅" : "❌"}
                          </span>
                          <span>Contiene "END PRIVATE KEY"</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.contiene_backslash_n ? "text-yellow-600" : "text-green-600"}>
                            {firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.contiene_backslash_n ? "⚠️" : "✅"}
                          </span>
                          <span>Contiene "\n" letterali: {firebaseDebugData.data.environment.FIREBASE_PRIVATE_KEY.contiene_backslash_n ? "Sì (verranno convertiti automaticamente)" : "No"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dettagli Parsing Chiave Privata */}
                {firebaseDebugData.data.stato_inizializzazione.dettagli_parsing && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <div className="font-semibold mb-2 text-xs">Dettagli Parsing Chiave Privata:</div>
                    <div className="text-xs space-y-1 bg-gray-50 p-2 rounded">
                      <div>Lunghezza RAW: {firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.lunghezza_raw} caratteri</div>
                      <div>Lunghezza dopo pulizia: {firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.lunghezza_dopo_pulizia} caratteri</div>
                      <div className="flex items-center gap-2">
                        <span className={firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.aveva_virgolette ? "text-yellow-600" : "text-green-600"}>
                          {firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.aveva_virgolette ? "⚠️" : "✅"}
                        </span>
                        <span>Aveva virgolette: {firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.aveva_virgolette ? "Sì (rimosse)" : "No"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.aveva_backslash_n ? "text-yellow-600" : "text-green-600"}>
                          {firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.aveva_backslash_n ? "⚠️" : "✅"}
                        </span>
                        <span>Conteneva \n letterali: {firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.aveva_backslash_n ? "Sì" : "No"}</span>
                      </div>
                      <div>Newline reali dopo parsing: {firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.newline_reali_dopo_parsing}</div>
                      <div className="flex items-center gap-2">
                        <span className={firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.inizia_correttamente ? "text-green-600" : "text-red-600"}>
                          {firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.inizia_correttamente ? "✅" : "❌"}
                        </span>
                        <span>Inizia correttamente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.finisce_correttamente ? "text-green-600" : "text-red-600"}>
                          {firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.finisce_correttamente ? "✅" : "❌"}
                        </span>
                        <span>Finisce correttamente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.sembra_completa ? "text-green-600" : "text-red-600"}>
                          {firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.sembra_completa ? "✅" : "❌"}
                        </span>
                        <span>Sembra completa ({firebaseDebugData.data.stato_inizializzazione.dettagli_parsing.lunghezza_dopo_pulizia > 1000 ? "OK" : "TROPPO CORTA"})</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Test Invio Reale */}
                {firebaseDebugData.data.stato_inizializzazione.test_invio && (
                  <div className="mt-4 p-3 rounded-lg border-2">
                    <div className="font-semibold mb-2 flex items-center gap-2">
                      {firebaseDebugData.data.stato_inizializzazione.test_invio.successo === true ? (
                        <>
                          <span className="text-green-600">✅</span>
                          <span>Test Invio Reale: Successo</span>
                        </>
                      ) : firebaseDebugData.data.stato_inizializzazione.test_invio.successo === false ? (
                        <>
                          <span className="text-red-600">❌</span>
                          <span>Test Invio Reale: Fallito</span>
                        </>
                      ) : (
                        <>
                          <span className="text-gray-600">ℹ️</span>
                          <span>Test Invio Reale: Non disponibile</span>
                        </>
                      )}
                    </div>
                    <div className="text-sm">
                      {firebaseDebugData.data.stato_inizializzazione.test_invio.messaggio && (
                        <div className="mb-2">{firebaseDebugData.data.stato_inizializzazione.test_invio.messaggio}</div>
                      )}
                      {firebaseDebugData.data.stato_inizializzazione.test_invio.message_id && (
                        <div className="text-xs text-gray-600 font-mono bg-green-50 p-2 rounded">
                          Message ID: {firebaseDebugData.data.stato_inizializzazione.test_invio.message_id}
                        </div>
                      )}
                      {firebaseDebugData.data.stato_inizializzazione.test_invio.errore && (
                        <div className="text-xs text-red-600 font-mono bg-red-50 p-2 rounded mt-2">
                          <div><strong>Errore:</strong> {firebaseDebugData.data.stato_inizializzazione.test_invio.errore}</div>
                          {firebaseDebugData.data.stato_inizializzazione.test_invio.codice && (
                            <div><strong>Codice:</strong> {firebaseDebugData.data.stato_inizializzazione.test_invio.codice}</div>
                          )}
                          {/* Suggerimenti specifici basati sul codice errore */}
                          {firebaseDebugData.data.stato_inizializzazione.test_invio.codice === 'app/invalid-credential' && (
                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                              <strong>💡 Suggerimenti per invalid-credential:</strong>
                              <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                                <li>Verifica che la chiave privata corrisponda al service account corretto</li>
                                <li>Assicurati che il service account non sia stato eliminato su Firebase</li>
                                <li>Verifica che FIREBASE_CLIENT_EMAIL corrisponda esattamente all'email del service account</li>
                                <li>Se hai appena generato una nuova chiave, assicurati di averla copiata completamente</li>
                                <li>Controlla che non ci siano spazi o caratteri extra quando incolli la chiave su Render.com</li>
                              </ul>
                            </div>
                          )}
                          {firebaseDebugData.data.stato_inizializzazione.test_invio.errore.includes('invalid_grant') && (
                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                              <strong>💡 Suggerimenti per invalid_grant (account not found):</strong>
                              <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                                <li><strong>VERIFICA CRITICA:</strong> Il FIREBASE_CLIENT_EMAIL su Render.com deve corrispondere ESATTAMENTE all'email nel file JSON scaricato</li>
                                <li>Nel file JSON, cerca il campo "client_email" e copia quel valore esatto su Render.com</li>
                                <li>L'email dovrebbe essere: <code>firebase-adminsdk-xxxxx@demos-finale.iam.gserviceaccount.com</code></li>
                                <li>Assicurati che la chiave privata e il client_email provengano dallo stesso file JSON</li>
                                <li>Se hai generato una nuova chiave, usa il client_email di quella nuova chiave</li>
                                <li>La chiave potrebbe essere stata revocata o eliminata su Firebase</li>
                                <li>Il service account potrebbe non esistere più</li>
                                <li>Verifica che il tempo del server su Render.com sia sincronizzato</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Errori */}
                {firebaseDebugData.data.stato_inizializzazione.errore && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold mb-2">Errore durante l'inizializzazione:</div>
                      <div className="text-sm font-mono bg-red-50 p-2 rounded">
                        <div><strong>Messaggio:</strong> {firebaseDebugData.data.stato_inizializzazione.errore.message}</div>
                        {firebaseDebugData.data.stato_inizializzazione.errore.code && (
                          <div><strong>Codice:</strong> {firebaseDebugData.data.stato_inizializzazione.errore.code}</div>
                        )}
                        {firebaseDebugData.data.stato_inizializzazione.errore.name && (
                          <div><strong>Nome errore:</strong> {firebaseDebugData.data.stato_inizializzazione.errore.name}</div>
                        )}
                        {firebaseDebugData.data.stato_inizializzazione.errore.stack && (
                          <div className="mt-2 text-xs overflow-auto max-h-32">
                            <strong>Stack:</strong>
                            <pre className="whitespace-pre-wrap">{firebaseDebugData.data.stato_inizializzazione.errore.stack}</pre>
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Suggerimenti */}
                {(!firebaseDebugData.data.stato_inizializzazione.admin_disponibile || 
                  firebaseDebugData.data.verifica_corrispondenza?.client_email_matches === false) && (
                  <Alert variant={firebaseDebugData.data.verifica_corrispondenza?.client_email_matches === false ? "destructive" : "default"}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {firebaseDebugData.data.verifica_corrispondenza?.client_email_matches === false ? (
                        <>
                          <div className="font-semibold mb-2 text-red-600">⚠️ PROBLEMA CRITICO: Client Email non corrisponde!</div>
                          <div className="text-sm mb-2">
                            Il <code>FIREBASE_CLIENT_EMAIL</code> su Render.com non corrisponde all'email del service account per cui è stata generata la chiave privata.
                            Questo causa l'errore <code>invalid_grant (account not found)</code>.
                          </div>
                          <div className="font-semibold mb-2">Cosa fare:</div>
                          <ol className="list-decimal list-inside space-y-1 text-sm">
                            <li>Vai su Render.com → demos-backend → Environment Variables</li>
                            <li>Trova <code>FIREBASE_CLIENT_EMAIL</code></li>
                            <li>Aggiorna il valore con: <code className="bg-gray-100 px-1 rounded">firebase-adminsdk-fbsvc@demos-finale.iam.gserviceaccount.com</code></li>
                            <li>Assicurati che corrisponda ESATTAMENTE all'email nel file JSON scaricato (campo <code>"client_email"</code>)</li>
                            <li>Salva e riavvia il servizio</li>
                          </ol>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold mb-2">Cosa fare:</div>
                          <ol className="list-decimal list-inside space-y-1 text-sm">
                            <li>Vai su Render.com → demos-backend → Environment Variables</li>
                            <li>Verifica che FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY siano presenti</li>
                            <li>Assicurati che FIREBASE_PRIVATE_KEY sia la chiave completa senza virgolette iniziali/finali</li>
                            <li>La chiave deve essere lunga ~1600-1700 caratteri (non 168 o meno)</li>
                            <li>Riavvia il servizio dopo aver modificato le variabili</li>
                          </ol>
                          {firebaseDebugData.data.stato_inizializzazione.errore?.code === 'app/invalid-credential' && (
                            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                              <strong>⚠️ Errore invalid-credential specifico:</strong>
                              <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                                <li>Genera una nuova chiave dal service account su Firebase Console</li>
                                <li>Verifica che FIREBASE_CLIENT_EMAIL corrisponda esattamente all'email del service account</li>
                                <li>Controlla che la chiave non sia stata revocata o eliminata</li>
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Verifica Corrispondenza Variabili */}
                {firebaseDebugData.data.verifica_corrispondenza && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <div className="font-semibold mb-2 text-xs">Verifica Corrispondenza:</div>
                    <div className="text-xs space-y-1 bg-gray-50 p-2 rounded">
                      <div className="flex items-center gap-2">
                        <span className={firebaseDebugData.data.verifica_corrispondenza.project_id_match ? "text-green-600" : "text-red-600"}>
                          {firebaseDebugData.data.verifica_corrispondenza.project_id_match ? "✅" : "❌"}
                        </span>
                        <span>Project ID corrisponde: {firebaseDebugData.data.verifica_corrispondenza.project_id_match ? "Sì (demos-finale)" : "No"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={firebaseDebugData.data.verifica_corrispondenza.client_email_format ? "text-green-600" : "text-red-600"}>
                          {firebaseDebugData.data.verifica_corrispondenza.client_email_format ? "✅" : "❌"}
                        </span>
                        <span>Formato client_email corretto</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={firebaseDebugData.data.verifica_corrispondenza.client_email_matches ? "text-green-600" : "text-red-600"}>
                          {firebaseDebugData.data.verifica_corrispondenza.client_email_matches ? "✅" : "❌"}
                        </span>
                        <span>Client Email corrisponde esattamente</span>
                      </div>
                      {!firebaseDebugData.data.verifica_corrispondenza.client_email_matches && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                          <div><strong>Atteso:</strong> <code>{firebaseDebugData.data.verifica_corrispondenza.client_email_expected}</code></div>
                          <div><strong>Attuale:</strong> <code>{firebaseDebugData.data.verifica_corrispondenza.client_email_actual}</code></div>
                          <div className="mt-1 text-red-600 font-semibold">⚠️ I valori non corrispondono! Aggiorna FIREBASE_CLIENT_EMAIL su Render.com</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Verifica Tempo Server */}
                {firebaseDebugData.data.tempo_server && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <div className="font-semibold mb-2 text-xs">Tempo Server:</div>
                    <div className="text-xs space-y-1 bg-gray-50 p-2 rounded">
                      <div className="flex items-center gap-2">
                        <span className={firebaseDebugData.data.tempo_server.sincronizzato ? "text-green-600" : "text-yellow-600"}>
                          {firebaseDebugData.data.tempo_server.sincronizzato ? "✅" : "⚠️"}
                        </span>
                        <span>Tempo sincronizzato: {firebaseDebugData.data.tempo_server.sincronizzato ? "Sì" : "Possibile problema"}</span>
                      </div>
                      <div>Differenza: {firebaseDebugData.data.tempo_server.differenza_secondi} secondi</div>
                      <div>Timestamp: {firebaseDebugData.data.tempo_server.timestamp}</div>
                      {firebaseDebugData.data.tempo_server.avviso && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                          {firebaseDebugData.data.tempo_server.avviso}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Informazioni aggiuntive se tutto è OK ma test fallisce */}
                {firebaseDebugData.data.stato_inizializzazione.admin_disponibile && 
                 firebaseDebugData.data.stato_inizializzazione.test_invio?.successo === false && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold mb-2">⚠️ Firebase Admin è configurato ma il test di invio fallisce</div>
                      <div className="text-sm">
                        Questo significa che Firebase Admin si inizializza correttamente, ma c'è un problema durante l'invio effettivo delle notifiche.
                        Controlla i log del backend su Render.com per vedere l'errore specifico di Firebase.
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
          </div>

          {/* Sezione 2: Test Notifiche Push */}
          <div className="flex flex-col">
        <Card className="bg-white shadow-sm h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TestTube className="h-5 w-5 text-emerald-600" />
              Test Notifiche Push
            </CardTitle>
            <CardDescription>
              Invia una notifica di test a tutti gli utenti con le preferenze "Demos" attivate per verificare il funzionamento delle notifiche push.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
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

          {/* Sezione 3: Notifica a Utente */}
          <div className="flex flex-col">
            <Card className="bg-white shadow-sm h-full flex flex-col sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <User className="h-5 w-5 text-purple-600" />
                  Notifica a Utente
                </CardTitle>
                <CardDescription>
                  Invia una notifica push a un utente specifico selezionato dalla tabella users.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
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


