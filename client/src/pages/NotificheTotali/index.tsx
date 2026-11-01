import React, { useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { hasAdminCapability } from "@/lib/admin-access";
import { useToast } from "@/hooks/use-toast";
import { UserAutocomplete } from "@/components/UserAutocomplete";
import { Activity, ArrowLeft, Bell, Building2, CheckCircle, Eye, Loader2, Send, Trash2, User as UserIcon, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

function NotificheTable({ notifiche, tipo }: { notifiche: any[]; tipo: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async ({ id, tabella }: { id: string; tabella: string }) => {
      const response = await apiRequest("DELETE", `/api/notifiche-totali/${tabella}/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifiche-totali"] });
      toast({ title: "Notifica cancellata" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error?.message || "Errore nella cancellazione della notifica", variant: "destructive" });
    },
  });

  const handleDelete = (id: string, tabella: string) => {
    if (window.confirm("Sei sicuro di voler cancellare questa notifica?")) deleteMutation.mutate({ id, tabella });
  };

  if (!notifiche.length) {
    return <div className="text-center py-8 text-gray-500"><Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" /><p>Nessuna notifica disponibile</p></div>;
  }

  const headers = () => {
    if (tipo === "voti_comuni") return <><TableHead>ID</TableHead><TableHead>Utente</TableHead><TableHead>Titolo</TableHead><TableHead>Testo</TableHead><TableHead>Data</TableHead><TableHead>Voto</TableHead><TableHead>Politico</TableHead><TableHead>Comune</TableHead><TableHead>Likes</TableHead><TableHead>Dislikes</TableHead><TableHead>Azioni</TableHead></>;
    if (tipo === "demos") return <><TableHead>ID</TableHead><TableHead>Utente</TableHead><TableHead>Titolo</TableHead><TableHead>Testo</TableHead><TableHead>Data</TableHead><TableHead>Azioni</TableHead></>;
    if (tipo === "avvistamenti") return <><TableHead>ID</TableHead><TableHead>Utente</TableHead><TableHead>Tipo Avvistamento</TableHead><TableHead>Comune</TableHead><TableHead>Data</TableHead><TableHead>Azioni</TableHead></>;
    return <><TableHead>ID</TableHead><TableHead>Utente</TableHead><TableHead>Titolo</TableHead><TableHead>Testo</TableHead><TableHead>Data</TableHead><TableHead>Comune</TableHead><TableHead>Azioni</TableHead></>;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>{headers()}</TableRow></TableHeader>
        <TableBody>
          {notifiche.map((notifica: any) => (
            <TableRow key={`${tipo}-${notifica.id}`}>
              <TableCell className="font-mono text-xs">{notifica.id ? `${String(notifica.id).slice(0, 8)}...` : "-"}</TableCell>
              <TableCell>{notifica.utente_nome && notifica.utente_cognome ? `${notifica.utente_nome} ${notifica.utente_cognome}` : notifica.utente_nome || notifica.utente_cognome || "-"}</TableCell>
              {tipo === "avvistamenti" ? (
                <><TableCell className="font-medium">{notifica.titolo || notifica.tipo_avvistamento || "Nessun tipo"}</TableCell><TableCell>{notifica.comune_residenza || "-"}</TableCell><TableCell>{notifica.data || notifica.data_creazione ? new Date(notifica.data || notifica.data_creazione).toLocaleDateString("it-IT") : "N/A"}</TableCell></>
              ) : (
                <><TableCell className="font-medium">{notifica.titolo || "Nessun titolo"}</TableCell><TableCell className="max-w-md"><p className="text-sm text-gray-600 truncate">{notifica.testo || notifica.messaggio || "Nessun messaggio"}</p></TableCell><TableCell>{notifica.data ? new Date(notifica.data).toLocaleDateString("it-IT") : "N/A"}</TableCell></>
              )}
              {tipo === "voti_comuni" && <><TableCell>{notifica.voto || "-"}</TableCell><TableCell>{notifica.politico || "-"}</TableCell></>}
              {tipo !== "demos" && <TableCell>{notifica.comune_residenza || "-"}</TableCell>}
              {tipo === "voti_comuni" && <><TableCell>{notifica.likes || 0}</TableCell><TableCell>{notifica.dislikes || 0}</TableCell></>}
              <TableCell><Button variant="destructive" size="sm" onClick={() => handleDelete(notifica.id, tipo)} disabled={deleteMutation.isPending} aria-label="Cancella notifica"><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function NotificheTotali() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = hasAdminCapability(user);
  // Legacy Firebase diagnostic GET can send a push: never fetch on page mount.
  const localDiagnosticsEnabled = import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_NOTIFICATION_DIAGNOSTICS === "true";

  const [demosTitle, setDemosTitle] = useState("");
  const [demosMessage, setDemosMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: string; displayName: string } | null>(null);
  const [userSearchValue, setUserSearchValue] = useState("");
  const [userTitle, setUserTitle] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const pendingUserSend = useRef<{ signature: string; key: string } | null>(null);
  const pendingSelfTestKey = useRef<string | null>(null);
  const getUserSendKey = (signature: string) => {
    if (pendingUserSend.current?.signature !== signature) {
      pendingUserSend.current = { signature, key: crypto.randomUUID() };
    }
    return pendingUserSend.current.key;
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["notifiche-totali"],
    queryFn: async () => (await apiRequest("GET", "/api/notifiche-totali")).data,
    enabled: isAdmin,
    refetchInterval: 60000,
  });

  const firebaseStatus = useQuery({
    queryKey: ["admin-notification-firebase-status"],
    queryFn: async () => (await apiRequest("GET", "/api/comunicazioni/debug-firebase-admin")).data,
    enabled: false, // Diagnostic GET only after an explicit local user action
    retry: false,
    refetchOnWindowFocus: false,
  });

  const demosStatus = useQuery({
    queryKey: ["admin-notification-demos-status"],
    queryFn: async () => (await apiRequest("GET", "/api/comunicazioni/debug-notifiche-demos")).data,
    enabled: false, // Diagnostic GET only after an explicit local user action
    retry: false,
    refetchOnWindowFocus: false,
  });

  const sendDemosMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Utente non autenticato");
      if (!demosTitle.trim() || !demosMessage.trim()) throw new Error("Titolo e messaggio sono obbligatori");
      return (await apiRequest("POST", "/api/comunicazioni", { titolo: demosTitle.trim(), commento: demosMessage.trim(), zona: "Generale", id_utente: user.id, tipo: "demos_notification" })).data;
    },
    onSuccess: () => {
      setDemosTitle(""); setDemosMessage("");
      queryClient.invalidateQueries({ queryKey: ["notifiche-totali"] });
      queryClient.invalidateQueries({ queryKey: ["notificationBadge"] });
      toast({ title: "Notifica Demos inviata" });
    },
    onError: (error: any) => toast({ title: "Invio fallito", description: error?.message || "Errore di invio", variant: "destructive" }),
  });

  const sendUserMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser?.id) throw new Error("Seleziona un utente");
      if (!userTitle.trim() || !userMessage.trim()) throw new Error("Titolo e messaggio sono obbligatori");
      return (await apiRequest("POST", "/api/comunicazioni/send-user-notification", { userId: selectedUser.id, titolo: userTitle.trim(), messaggio: userMessage.trim(), idempotencyKey: getUserSendKey(JSON.stringify([selectedUser.id, userTitle.trim(), userMessage.trim()])) })).data;
    },
    onSuccess: (result: any) => {
      pendingUserSend.current = null;
      setSelectedUser(null); setUserSearchValue(""); setUserTitle(""); setUserMessage("");
      queryClient.invalidateQueries({ queryKey: ["notifiche-totali"] });
      queryClient.invalidateQueries({ queryKey: ["notificationBadge"] });
      toast({
        title: result?.data?.push_inviato === true ? "Notifica salvata e push inviato" : "Notifica salvata nell'app",
        description: result?.message || "La notifica è disponibile nell'app."
      });
    },
    onError: (error: any) => toast({ title: "Invio fallito", description: error?.message || "Errore di invio", variant: "destructive" }),
  });

  const testSelfMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Utente non autenticato");
      return (await apiRequest("POST", "/api/comunicazioni/send-user-notification", { userId: user.id, titolo: "Test Firebase Admin", messaggio: "Notifica di test DEMOS per verificare la consegna push.", idempotencyKey: pendingSelfTestKey.current ?? (pendingSelfTestKey.current = crypto.randomUUID()) })).data;
    },
    onSuccess: (result: any) => {
      pendingSelfTestKey.current = null;
      toast({
      title: result?.data?.push_inviato === true ? "Test push inviato" : "Push di test non inviato",
      description: result?.message || "Controlla lo stato del dispositivo.",
      variant: result?.data?.push_inviato === true ? "default" : "destructive"
      });
    },
    onError: (error: any) => toast({ title: "Test fallito", description: error?.message || "Errore di invio", variant: "destructive" }),
  });

  if (isAuthLoading) return <PageContainer className="flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></PageContainer>;
  if (!user) return <Redirect to="/auth" />;
  if (!isAdmin) return <Redirect to="/preferiti" />;

  return (
    <PageContainer className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-[1800px] mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/gestisci")}><ArrowLeft className="h-5 w-5" /></Button>
          <div><h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Bell className="h-8 w-8 text-pink-600" />Notifiche</h1><p className="text-gray-600 mt-1">Un'unica superficie Admin per invio, diagnostica e cronologia delle notifiche DEMOS.</p></div>
        </div>

        <Tabs defaultValue="invio" className="space-y-5">
          <TabsList className="grid w-full max-w-2xl grid-cols-3"><TabsTrigger value="invio">Invio</TabsTrigger><TabsTrigger value="cronologia">Cronologia</TabsTrigger><TabsTrigger value="diagnostica">Diagnostica</TabsTrigger></TabsList>

          <TabsContent value="invio" className="space-y-5">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-indigo-600" />Notifica Demos</CardTitle><CardDescription>Invia una comunicazione agli utenti con le preferenze Demos abilitate.</CardDescription></CardHeader><CardContent className="space-y-4"><div><label className="text-sm font-medium">Titolo</label><Input value={demosTitle} onChange={(e) => setDemosTitle(e.target.value)} maxLength={120} /></div><div><label className="text-sm font-medium">Messaggio</label><Textarea value={demosMessage} onChange={(e) => setDemosMessage(e.target.value)} rows={6} maxLength={1000} /></div><Button onClick={() => sendDemosMutation.mutate()} disabled={sendDemosMutation.isPending || !demosTitle.trim() || !demosMessage.trim()}>{sendDemosMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Invia a Demos</Button></CardContent></Card>

              <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserIcon className="h-5 w-5 text-blue-600" />Notifica a un utente</CardTitle><CardDescription>Seleziona un account e invia una notifica mirata.</CardDescription></CardHeader><CardContent className="space-y-4"><div><label className="text-sm font-medium">Utente</label><UserAutocomplete value={userSearchValue} onChange={(value) => { setUserSearchValue(value); if (selectedUser && value !== selectedUser.displayName) setSelectedUser(null); }} onUserSelect={(selected) => setSelectedUser({ id: selected.id, displayName: selected.displayName })} placeholder="Cerca un utente..." /></div><div><label className="text-sm font-medium">Titolo</label><Input value={userTitle} onChange={(e) => setUserTitle(e.target.value)} maxLength={120} /></div><div><label className="text-sm font-medium">Messaggio</label><Textarea value={userMessage} onChange={(e) => setUserMessage(e.target.value)} rows={5} maxLength={1000} /></div><Button onClick={() => sendUserMutation.mutate()} disabled={sendUserMutation.isPending || !selectedUser || !userTitle.trim() || !userMessage.trim()}>{sendUserMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Invia all'utente</Button></CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="cronologia">
            <Card><CardHeader><CardTitle>Cronologia notifiche</CardTitle><CardDescription>Consulta e, quando necessario, elimina le notifiche registrate nel sistema.</CardDescription></CardHeader><CardContent>
              {isLoading ? <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : error ? <Alert variant="destructive"><AlertDescription>{error instanceof Error ? error.message : "Errore nel caricamento delle notifiche"}</AlertDescription></Alert> : !data?.notifiche ? <div className="text-center py-8 text-gray-500">Nessuna notifica disponibile</div> : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Card className="bg-blue-50"><CardContent className="pt-5"><div className="text-2xl font-bold text-blue-600">{data.stats?.voti_comuni || 0}</div><div className="text-xs text-gray-600">Voti Comuni</div></CardContent></Card><Card className="bg-pink-50"><CardContent className="pt-5"><div className="text-2xl font-bold text-pink-600">{data.stats?.demos || 0}</div><div className="text-xs text-gray-600">Demos</div></CardContent></Card><Card className="bg-green-50"><CardContent className="pt-5"><div className="text-2xl font-bold text-green-600">{data.stats?.comunali || 0}</div><div className="text-xs text-gray-600">Comunali</div></CardContent></Card><Card className="bg-purple-50"><CardContent className="pt-5"><div className="text-2xl font-bold text-purple-600">{data.stats?.avvistamenti || 0}</div><div className="text-xs text-gray-600">Avvistamenti</div></CardContent></Card></div>
                  <Tabs defaultValue="voti-comuni"><TabsList className="grid w-full grid-cols-4"><TabsTrigger value="voti-comuni"><Vote className="h-4 w-4 mr-1" />Voti</TabsTrigger><TabsTrigger value="demos"><Bell className="h-4 w-4 mr-1" />Demos</TabsTrigger><TabsTrigger value="comunali"><Building2 className="h-4 w-4 mr-1" />Comunali</TabsTrigger><TabsTrigger value="avvistamenti"><Eye className="h-4 w-4 mr-1" />Avvistamenti</TabsTrigger></TabsList><TabsContent value="voti-comuni" className="mt-5"><NotificheTable notifiche={data.notifiche?.voti_comuni || []} tipo="voti_comuni" /></TabsContent><TabsContent value="demos" className="mt-5"><NotificheTable notifiche={data.notifiche?.demos || []} tipo="demos" /></TabsContent><TabsContent value="comunali" className="mt-5"><NotificheTable notifiche={data.notifiche?.comunali || []} tipo="comunali" /></TabsContent><TabsContent value="avvistamenti" className="mt-5"><NotificheTable notifiche={data.notifiche?.avvistamenti || []} tipo="avvistamenti" /></TabsContent></Tabs>
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="diagnostica" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Firebase Admin</CardTitle><CardDescription>Verifica il backend usato per la consegna delle notifiche push.</CardDescription></CardHeader><CardContent className="space-y-3">{!localDiagnosticsEnabled ? <Alert><AlertDescription>Diagnostica disponibile solo nello sviluppo locale autorizzato.</AlertDescription></Alert> : firebaseStatus.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : firebaseStatus.isError ? <Alert variant="destructive"><AlertDescription>Diagnostica Firebase non disponibile.</AlertDescription></Alert> : <div className="flex items-center gap-2 text-sm text-green-700"><CheckCircle className="h-5 w-5" />Endpoint diagnostico raggiungibile.</div>}<Button variant="outline" onClick={() => firebaseStatus.refetch()} disabled={!localDiagnosticsEnabled || firebaseStatus.isFetching}>Aggiorna stato</Button></CardContent></Card>
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Preferenze Demos</CardTitle><CardDescription>Verifica il percorso di selezione dei destinatari Demos.</CardDescription></CardHeader><CardContent className="space-y-3">{!localDiagnosticsEnabled ? <Alert><AlertDescription>Diagnostica disponibile solo nello sviluppo locale autorizzato.</AlertDescription></Alert> : demosStatus.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : demosStatus.isError ? <Alert variant="destructive"><AlertDescription>Diagnostica Demos non disponibile.</AlertDescription></Alert> : <div className="flex items-center gap-2 text-sm text-green-700"><CheckCircle className="h-5 w-5" />Endpoint diagnostico raggiungibile.</div>}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => demosStatus.refetch()} disabled={!localDiagnosticsEnabled || demosStatus.isFetching}>Aggiorna stato</Button><Button variant="outline" onClick={() => testSelfMutation.mutate()} disabled={testSelfMutation.isPending}>{testSelfMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Invia test a me</Button></div></CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
