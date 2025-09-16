import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth-neon";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Loader2, Plus, Trash2, Calculator } from "lucide-react";
import { useLocation, Redirect } from "wouter";
import { apiRequest } from "@/lib/queryClient";

const comunicaSchema = z.object({
  titolo: z.string().min(1, "Il titolo è obbligatorio"),
  voto_dato: z.enum(["Favorevole", "Contrario", "Astenuto"]),
  commento: z.string().max(20, "Il commento non può superare i 20 caratteri").optional(),
  vincitore: z.enum(["Approvata", "Respinta"]),
});

const comunicaVotiSchema = z.object({
  titolo: z.string().min(1, "Il titolo è obbligatorio"),
  voti: z.array(z.object({
    nome: z.string().min(1, "Il nome è obbligatorio"),
    voto: z.enum(["Favorevole", "Contrario", "Astenuto"]),
  })).min(1, "Deve essere presente almeno un voto"),
});

const demosNotificationSchema = z.object({
  titolo: z.string().min(1, "Il titolo è obbligatorio"),
  commento: z.string().min(1, "Il commento è obbligatorio"),
});

type ComunicaFormData = z.infer<typeof comunicaSchema>;
type ComunicaVotiFormData = z.infer<typeof comunicaVotiSchema>;
type DemosNotificationFormData = z.infer<typeof demosNotificationSchema>;

interface ExistingComunicazione {
  titolo: string;
  vincitore: string;
  zona: string;
}

interface VotoEntry {
  id: string;
  nome: string;
  voto: "Favorevole" | "Contrario" | "Astenuto";
}

export default function Votazione() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [existingComunicazione, setExistingComunicazione] = useState<ExistingComunicazione | null>(null);
  
  // Stato per la sezione "Comunica Voti"
  const [votiEntries, setVotiEntries] = useState<VotoEntry[]>([
    { id: "1", nome: "", voto: "Favorevole" }
  ]);
  const [titoloVotazione, setTitoloVotazione] = useState("");

  const form = useForm<ComunicaFormData>({
    resolver: zodResolver(comunicaSchema),
    defaultValues: { titolo: "", commento: "" },
  });

  const demosForm = useForm<DemosNotificationFormData>({
    resolver: zodResolver(demosNotificationSchema),
    defaultValues: { titolo: "", commento: "" },
  });

  // Funzioni per gestire i voti
  const addVotoEntry = () => {
    const newId = (votiEntries.length + 1).toString();
    setVotiEntries([...votiEntries, { id: newId, nome: "", voto: "Favorevole" }]);
  };

  const removeVotoEntry = (id: string) => {
    if (votiEntries.length > 1) {
      setVotiEntries(votiEntries.filter(entry => entry.id !== id));
    }
  };

  const updateVotoEntry = (id: string, field: keyof VotoEntry, value: string) => {
    setVotiEntries(votiEntries.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  // Calcolo automatico del risultato
  const calculateResult = () => {
    const favorevoli = votiEntries.filter(entry => entry.voto === "Favorevole" && entry.nome.trim()).length;
    const contrari = votiEntries.filter(entry => entry.voto === "Contrario" && entry.nome.trim()).length;
    const astenuti = votiEntries.filter(entry => entry.voto === "Astenuto" && entry.nome.trim()).length;
    
    return {
      favorevoli,
      contrari,
      astenuti,
      totale: favorevoli + contrari + astenuti,
      risultato: favorevoli > contrari ? "Approvata" : contrari > favorevoli ? "Respinta" : "Pareggio"
    };
  };

  const result = calculateResult();

  // Mutazione per salvare i voti della sezione "Comunica Voti"
  const submitComunicaVoti = useMutation({
    mutationFn: async () => {
      if (!titoloVotazione.trim() || result.totale === 0) {
        throw new Error("Titolo e almeno un voto sono obbligatori");
      }

      const comunicazioneData = {
        titolo: titoloVotazione,
        vincitore: result.risultato,
        zona: "Generale",
        id_utente: user?.id,
        tipo: "comunica_voti",
        voti: votiEntries.filter(entry => entry.nome.trim()).map(entry => ({
          nome: entry.nome,
          voto: entry.voto
        }))
      };

      return apiRequest("POST", "/api/comunicazioni", comunicazioneData);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      toast({
        title: "Voti salvati",
        description: `Votazione "${titoloVotazione}" registrata con ${result.totale} voti. Risultato: ${result.risultato}`
      });

      // Reset del form
      setTitoloVotazione("");
      setVotiEntries([{ id: "1", nome: "", voto: "Favorevole" }]);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel salvataggio dei voti.",
        variant: "destructive"
      });
    },
  });

  // Mutazione per le notifiche di Demos
  const submitDemosNotification = useMutation({
    mutationFn: (data: DemosNotificationFormData) => {
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
      
      return apiRequest("POST", "/api/comunicazioni", comunicazioneData);
    },
    onSuccess: () => {
      toast({ 
        title: "Notifica inviata", 
        description: "La notifica di Demos è stata inviata a tutti gli utenti." 
      });
      demosForm.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Invio fallito.", 
        variant: "destructive" 
      });
    },
  });

  // 1. Caricamento dati utente con React Query (già presente e corretto)
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ["userData", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await apiRequest("GET", `/api/users/${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch user data');
      return response.json();
    },
    enabled: !!user,
  });

  // 2. Controllo duplicati tramite API (usando una mutazione per la flessibilità)
  const checkDuplicateMutation = useMutation({
      mutationFn: async (titolo: string) => {
        if (!titolo.trim()) return;
        const response = await apiRequest("GET", `/api/comunicazioni/check-duplicate?titolo=${encodeURIComponent(titolo)}`);
        const data = await response.json();
        if (data.exists) {
            setExistingComunicazione(data.comunicazione);
            form.setValue("vincitore", data.comunicazione.vincitore);
        } else {
            setExistingComunicazione(null);
        }
      },
  });

  // 3. Submit comunicazione tramite API (già presente, solo ripulito)
  const submitComunicazione = useMutation({
    mutationFn: (data: ComunicaFormData) => {
      const comunicazioneData = {
        titolo: data.titolo,
        voto_dato: data.voto_dato,
        commento: data.commento,
        vincitore: data.vincitore,
        zona: "Generale", // Puoi personalizzare questo
        id_utente: user?.id,
        tipo: "votazione"
      };
      return apiRequest("POST", "/api/comunicazioni", comunicazioneData);
    },
    onSuccess: () => {
      toast({ title: "Comunicazione inviata", description: "La tua comunicazione è stata registrata." });
      form.reset();
      setExistingComunicazione(null);
      setTimeout(() => setLocation("/menu"), 1000);
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Invio fallito.", variant: "destructive" });
    },
  });

  if (isAuthLoading || (user && isLoadingUser)) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) return <Redirect to="/auth" />;

  const userRole = userData?.ruolo || user?.ruolo;
  const isAllowed = userRole === "Politico" || userRole === "Candidato Politico" || userRole === "Admin";
  const canComunicaVoti = userRole === "Admin" || userRole === "Istituzione";
  const canSendDemosNotifications = userRole === "Admin";
  
  if (userData && !isAllowed) {
    return (
      <div className="min-h-screen container mx-auto p-4 flex items-center justify-center">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Accesso negato</AlertTitle>
          <AlertDescription>Questa sezione è accessibile solo ai Politici, Candidati Politici e Admin.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 page-with-navbar">
      <div className="container mx-auto px-4 py-8 pb-24 space-y-6">
        <Card className="w-full bg-white">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Nuova Comunicazione Votazione</CardTitle>
            <CardDescription className="text-center">Condividi i dettagli di una votazione con i tuoi elettori.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {existingComunicazione && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Votazione già comunicata</AlertTitle>
                <AlertDescription>
                  Questa votazione è già stata registrata per la tua zona. Puoi comunque aggiungere il tuo voto.
                  <br /><strong>Risultato registrato:</strong> {existingComunicazione.vincitore}
                </AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => submitComunicazione.mutate(data))} className="space-y-4">
                <FormField control={form.control} name="titolo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titolo della votazione *</FormLabel>
                    <FormControl><Input placeholder="Es: Approvazione legge..." {...field} onChange={(e) => { field.onChange(e); checkDuplicateMutation.mutate(e.target.value); }} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="voto_dato" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Il tuo voto *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleziona il tuo voto" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Favorevole">Favorevole</SelectItem>
                        <SelectItem value="Contrario">Contrario</SelectItem>
                        <SelectItem value="Astenuto">Astenuto</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="commento" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commento (opzionale, max 20 caratteri)</FormLabel>
                    <FormControl><Input {...field} maxLength={20} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="vincitore" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risultato della votazione *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!existingComunicazione}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleziona il risultato" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Approvata">Approvata</SelectItem>
                        <SelectItem value="Respinta">Respinta</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={submitComunicazione.isPending || checkDuplicateMutation.isPending}>
                  {submitComunicazione.isPending ? "Invio in corso..." : "Invia Comunicazione"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

               {/* Sezione Comunica Voti - Solo per Admin e Istituzione */}
               {canComunicaVoti && (
                 <Card className="w-full bg-white">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
                <Calculator className="h-6 w-6" />
                Comunica Voti
              </CardTitle>
              <CardDescription className="text-center">
                Registra i voti di una votazione e calcola automaticamente il risultato.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Titolo della votazione */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Titolo della votazione *</label>
                <Input
                  placeholder="Es: Approvazione legge..."
                  value={titoloVotazione}
                  onChange={(e) => setTitoloVotazione(e.target.value)}
                />
              </div>

              {/* Lista voti */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Voti registrati</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addVotoEntry}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Aggiungi voto
                  </Button>
                </div>

                {votiEntries.map((entry, index) => (
                  <div key={entry.id} className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-600">Nome</label>
                        <Input
                          placeholder="Inserisci nome"
                          value={entry.nome}
                          onChange={(e) => updateVotoEntry(entry.id, "nome", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Voto</label>
                        <Select
                          value={entry.voto}
                          onValueChange={(value) => updateVotoEntry(entry.id, "voto", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Favorevole">Favorevole</SelectItem>
                            <SelectItem value="Contrario">Contrario</SelectItem>
                            <SelectItem value="Astenuto">Astenuto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {votiEntries.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVotoEntry(entry.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Risultato della votazione */}
              {result.totale > 0 && (
                <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4 text-center">Risultato della votazione</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-green-100 p-3 rounded">
                      <div className="text-2xl font-bold text-green-700">{result.favorevoli}</div>
                      <div className="text-sm text-green-600">Favorevoli</div>
                    </div>
                    <div className="bg-red-100 p-3 rounded">
                      <div className="text-2xl font-bold text-red-700">{result.contrari}</div>
                      <div className="text-sm text-red-600">Contrari</div>
                    </div>
                    <div className="bg-gray-100 p-3 rounded">
                      <div className="text-2xl font-bold text-gray-700">{result.astenuti}</div>
                      <div className="text-sm text-gray-600">Astenuti</div>
                    </div>
                    <div className="bg-blue-100 p-3 rounded">
                      <div className="text-2xl font-bold text-blue-700">{result.totale}</div>
                      <div className="text-sm text-blue-600">Totale</div>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <div className="text-lg font-semibold">
                      Risultato: <span className={`font-bold ${
                        result.risultato === "Approvata" ? "text-green-600" : 
                        result.risultato === "Respinta" ? "text-red-600" : 
                        "text-gray-600"
                      }`}>
                        {result.risultato}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Pulsante salva */}
              <Button
                className="w-full"
                disabled={!titoloVotazione.trim() || result.totale === 0 || submitComunicaVoti.isPending}
                onClick={() => submitComunicaVoti.mutate()}
              >
                {submitComunicaVoti.isPending ? "Salvataggio in corso..." : "Salva Votazione"}
              </Button>
            </CardContent>
          </Card>
               )}

               {/* Sezione Notifiche di Demos - Solo per Admin */}
               {canSendDemosNotifications && (
                 <Card className="w-full bg-white">
                   <CardHeader>
                     <CardTitle className="text-2xl font-bold text-center">
                       Notifiche di Demos
                     </CardTitle>
                     <CardDescription className="text-center">
                       Invia notifiche a tutti gli utenti dell'applicazione.
                     </CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-6">
                     <Form {...demosForm}>
                       <form onSubmit={demosForm.handleSubmit((data) => submitDemosNotification.mutate(data))} className="space-y-4">
                         <FormField control={demosForm.control} name="titolo" render={({ field }) => (
                           <FormItem>
                             <FormLabel>Titolo della notifica *</FormLabel>
                             <FormControl><Input placeholder="Es: Aggiornamento importante..." {...field} /></FormControl>
                             <FormMessage />
                           </FormItem>
                         )} />
                         <FormField control={demosForm.control} name="commento" render={({ field }) => (
                           <FormItem>
                             <FormLabel>Commento *</FormLabel>
                             <FormControl><Input placeholder="Inserisci il messaggio per tutti gli utenti..." {...field} /></FormControl>
                             <FormMessage />
                           </FormItem>
                         )} />
                         <Button type="submit" className="w-full" disabled={submitDemosNotification.isPending}>
                           {submitDemosNotification.isPending ? "Invio in corso..." : "Invia Notifica a Tutti"}
                         </Button>
                       </form>
                     </Form>
                   </CardContent>
                 </Card>
               )}
             </div>
           </div>
         );
       }