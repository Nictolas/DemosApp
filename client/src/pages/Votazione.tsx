import React, { useState, useCallback } from "react";
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
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Loader2, Plus, Trash2, Calculator, Vote } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation, Redirect } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { UserAutocomplete } from "@/components/UserAutocomplete";
import { ConsiglieriComunaliAutocomplete } from "@/components/ConsiglieriComunaliAutocomplete";

const comunicaSchema = z.object({
  titolo: z.string().min(1, "Il titolo è obbligatorio"),
  voto_dato: z.enum(["Favorevole", "Contrario", "Astenuto"]),
  commento: z.string().optional(),
  vincitore: z.enum(["Approvata", "Parità", "Respinta"]),
});

const comunicaVotiSchema = z.object({
  titolo: z.string().min(1, "Il titolo è obbligatorio"),
  voti: z.array(z.object({
    nome: z.string().min(1, "Il nome è obbligatorio"),
    voto: z.enum(["Favorevole", "Contrario", "Astenuto"]),
  })).min(1, "Deve essere presente almeno un voto"),
});

type ComunicaFormData = z.infer<typeof comunicaSchema>;
type ComunicaVotiFormData = z.infer<typeof comunicaVotiSchema>;

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

// Componente per Comunica Voti - spostato fuori dal componente principale
const ComunicaVotiCard = React.memo(({ 
  titoloVotazione, 
  setTitoloVotazione, 
  votiEntries, 
  addVotoEntry, 
  updateVotoEntry, 
  removeVotoEntry, 
  submitComunicaVoti 
}: {
  titoloVotazione: string;
  setTitoloVotazione: (value: string) => void;
  votiEntries: Array<{ id: string; nome: string; voto: string }>;
  addVotoEntry: () => void;
  updateVotoEntry: (id: string, field: keyof VotoEntry, value: string) => void;
  removeVotoEntry: (id: string) => void;
  submitComunicaVoti: any;
}) => (
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
      {/* Titolo della votazione - semplificato */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Titolo della votazione *</label>
        <input
          type="text"
          placeholder="Es: Approvazione legge..."
          value={titoloVotazione}
          onChange={(e) => setTitoloVotazione(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Lista voti */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Voti registrati</label>
          <button
            type="button"
            onClick={addVotoEntry}
            className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Aggiungi voto
          </button>
        </div>

        {votiEntries.map((entry, index) => {
          // Calcola i nomi esclusi (tutti gli altri nomi già selezionati)
          const excludedNames = votiEntries
            .filter(e => e.id !== entry.id && e.nome.trim())
            .map(e => e.nome.trim());
          
          return (
            <div key={entry.id} className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-600">Nome</label>
                    <ConsiglieriComunaliAutocomplete
                      value={entry.nome}
                      onChange={(value) => updateVotoEntry(entry.id, "nome", value)}
                      placeholder="Seleziona consigliere comunale"
                      className="w-full"
                      excludedNames={excludedNames}
                    />
                  </div>
                <div>
                  <label className="text-xs text-gray-600">Voto</label>
                  <div className="flex justify-center mt-1">
                    <div className="flex w-full">
                      {[
                        { value: "Favorevole", color: "bg-green-600 text-white" },
                        { value: "Astenuto", color: "bg-yellow-500 text-white" },
                        { value: "Contrario", color: "bg-red-600 text-white" }
                      ].map((option, idx) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`flex-1 py-2 text-sm font-medium transition-transform duration-150 focus:outline-none border border-gray-200 ${
                            idx === 0 ? 'rounded-l-full' : ''
                          } ${
                            idx === 2 ? 'rounded-r-full' : ''
                          } ${
                            entry.voto === option.value 
                              ? option.color + ' scale-95 z-10' 
                              : 'bg-white hover:bg-gray-10 z-0'
                          }`}
                          onClick={() => updateVotoEntry(entry.id, "voto", option.value)}
                        >
                          {option.value}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
            </div>
            {votiEntries.length > 1 && (
              <button
                type="button"
                onClick={() => removeVotoEntry(entry.id)}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          );
        })}
      </div>

      {/* Pulsante salva */}
      <button
        type="button"
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
        disabled={!titoloVotazione.trim() || submitComunicaVoti.isPending}
        onClick={() => submitComunicaVoti.mutate()}
      >
        {submitComunicaVoti.isPending ? "Salvataggio in corso..." : "Salva Votazione"}
      </button>
    </CardContent>
  </Card>
));


const Votazione = React.memo(function Votazione() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [existingComunicazione, setExistingComunicazione] = useState<ExistingComunicazione | null>(null);
  
  // Stato per la sezione "Comunica Voti"
  const [votiEntries, setVotiEntries] = useState<VotoEntry[]>([
    { id: "1", nome: "", voto: "Favorevole" }
  ]);
  const [titoloVotazione, setTitoloVotazione] = useState("");

  const form = useForm<ComunicaFormData>({
    resolver: zodResolver(comunicaSchema),
    defaultValues: { titolo: "", voto_dato: "Favorevole", commento: "", vincitore: "Approvata" },
  });


  // Funzione per controllare duplicati solo al blur (temporaneamente disabilitata per debug)
  const handleTitoloBlur = useCallback((value: string) => {
    // Temporaneamente disabilitato per debug focus
    // if (value.trim()) {
    //   checkDuplicateMutation.mutate(value);
    // }
  }, []);



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

  // Funzione semplificata per aggiornare i voti
  const updateVotoEntry = (id: string, field: keyof VotoEntry, value: string) => {
    setVotiEntries(prev => prev.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  // Calcolo automatico del risultato - rimosso per evitare re-render
  // const result = { favorevoli: 0, contrari: 0, astenuti: 0, totale: 0, risultato: "Pareggio" };

  // Mutazione per salvare i voti della sezione "Comunica Voti"
  const submitComunicaVoti = useMutation({
    mutationFn: async () => {
      const validVoti = votiEntries.filter(entry => entry.nome.trim());
      if (!titoloVotazione.trim() || validVoti.length === 0) {
        throw new Error("Titolo e almeno un voto sono obbligatori");
      }

      // Validazione duplicati nella stessa votazione
      const nomi = validVoti.map(entry => entry.nome.trim());
      const nomiUnici = new Set(nomi);
      if (nomi.length !== nomiUnici.size) {
        throw new Error("Un consigliere comunale non può essere inserito due volte nella stessa votazione");
      }

      // Validazione che tutti i nomi siano consiglieri comunali validi
      try {
        const consiglieriResponse = await apiRequest("GET", `/api/users/consiglieri-comunali`);
        if (!consiglieriResponse.ok) {
          throw new Error("Errore nel recupero dei consiglieri comunali");
        }
        
        const consiglieriData = await consiglieriResponse.json();
        const consiglieriNames = consiglieriData.consiglieri.map((c: any) => c.displayName);
        
        for (const entry of validVoti) {
          if (!consiglieriNames.includes(entry.nome.trim())) {
            throw new Error(`"${entry.nome}" non è un consigliere comunale valido per il tuo comune. Seleziona un nome dalla lista suggerita.`);
          }
        }
      } catch (error: any) {
        throw new Error(error.message || "Errore nella validazione dei consiglieri comunali");
      }

      const comunicazioneData = {
        titolo: titoloVotazione,
        vincitore: "Approvata", // Valore fisso per test
        zona: "Generale",
        id_utente: user?.id,
        tipo: "istituzione", // Cambiato da "comunica_voti" a "istituzione"
        voti: validVoti.map(entry => ({
          nome: entry.nome,
          voto: entry.voto
        }))
      };

      return apiRequest("POST", "/api/comunicazioni", comunicazioneData);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      const validVoti = votiEntries.filter(entry => entry.nome.trim());
      toast({
        title: "Voti salvati",
        description: `Votazione "${titoloVotazione}" registrata con ${validVoti.length} voti.`
      });

      // Reset del form
      setTitoloVotazione("");
      setVotiEntries([{ id: "1", nome: "", voto: "Favorevole" }]);
      queryClient.invalidateQueries({ queryKey: ['notifiche'] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel salvataggio dei voti.",
        variant: "destructive"
      });
    },
  });



  // 1. Caricamento dati utente con React Query (temporaneamente disabilitato per debug)
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ["userData", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await apiRequest("GET", `/api/users/${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch user data');
      return response.json();
    },
    enabled: false, // Disabilitato per debug focus
  });

  // 2. Controllo duplicati tramite API (temporaneamente disabilitato per debug focus)
  // const checkDuplicateMutation = useMutation({
  //     mutationFn: async (titolo: string) => {
  //       if (!titolo.trim()) return;
  //       const response = await apiRequest("GET", `/api/comunicazioni/check-duplicate?titolo=${encodeURIComponent(titolo)}`);
  //       const data = await response.json();
  //       if (data.exists) {
  //           setExistingComunicazione(data.comunicazione);
  //           form.setValue("vincitore", data.comunicazione.vincitore);
  //       } else {
  //           setExistingComunicazione(null);
  //       }
  //     },
  // });

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
      queryClient.invalidateQueries({ queryKey: ['notifiche'] });
      setTimeout(() => setLocation("/preferiti"), 1000);
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Invio fallito.", variant: "destructive" });
    },
  });

  // Funzione per gestire l'invio del form
  const onSubmit = useCallback((data: ComunicaFormData) => {
    console.log('📝 Form submitted with data:', data);
    submitComunicazione.mutate(data);
  }, [submitComunicazione]);

  if (isAuthLoading || (user && isLoadingUser)) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) return <Redirect to="/auth" />;

  const userRole = userData?.ruolo || user?.ruolo;
  const isAllowed = userRole === "P" || userRole === "CP" || userRole === "AD";
  const canComunicaVoti = userRole === "AD" || userRole === "I";
  const isAdmin = userRole === "AD";
  
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

  // Componente per Nuova Comunicazione Votazione - ottimizzato per evitare perdita di focus
  const NuovaComunicazioneCard = React.memo(() => {
    // Usa useState locale per evitare re-render del form
    const [titolo, setTitolo] = useState("");
    const [commento, setCommento] = useState("");
    const [votoDato, setVotoDato] = useState<"Favorevole" | "Contrario" | "Astenuto">("Favorevole");
    const [vincitore, setVincitore] = useState<"Approvata" | "Parità" | "Respinta">("Approvata");

    // Funzione per gestire l'invio con i valori locali
    const handleSubmit = () => {
      // Validazione locale
      if (!titolo.trim()) {
        toast({ title: "Errore", description: "Il titolo è obbligatorio", variant: "destructive" });
        return;
      }

      const formData = {
        titolo: titolo.trim(),
        voto_dato: votoDato,
        commento: commento.trim(),
        vincitore
      };
      
      console.log('📝 Form submitted with local data:', formData);
      submitComunicazione.mutate(formData);
    };

    // Reset del form locale quando la comunicazione viene inviata con successo
    React.useEffect(() => {
      if (submitComunicazione.isSuccess) {
        setTitolo("");
        setCommento("");
        setVotoDato("Favorevole");
        setVincitore("Approvata");
      }
    }, [submitComunicazione.isSuccess]);

    return (
      <Card className="w-full bg-white">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <Vote className="h-6 w-6" />
            Nuova Comunicazione Votazione
          </CardTitle>
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
          
          {/* Form per Nuova Comunicazione Votazione */}
          <div className="space-y-6">
            {/* Titolo della votazione */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Titolo della votazione *</label>
              <input 
                type="text"
                placeholder="Es: Approvazione legge..."
                value={titolo}
                onChange={(e) => setTitolo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {form.formState.errors.titolo && (
                <p className="text-sm text-red-600">{form.formState.errors.titolo.message}</p>
              )}
            </div>
            
            {/* Il tuo voto - Pulsanti come in /opinioni-nazionali */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Il tuo voto *</label>
              <div className="flex justify-center">
                <div className="flex w-full max-w-md">
                  {[
                    { value: "Favorevole", color: "bg-green-600 text-white" },
                    { value: "Astenuto", color: "bg-yellow-500 text-white" },
                    { value: "Contrario", color: "bg-red-600 text-white" }
                  ].map((option, idx) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`flex-1 py-3 text-base font-medium transition-transform duration-150 focus:outline-none border border-gray-200 ${
                        idx === 0 ? 'rounded-l-full' : ''
                      } ${
                        idx === 2 ? 'rounded-r-full' : ''
                      } ${
                        votoDato === option.value 
                          ? option.color + ' scale-95 z-10' 
                          : 'bg-white hover:bg-gray-10 z-0'
                      }`}
                      onClick={() => setVotoDato(option.value as "Favorevole" | "Contrario" | "Astenuto")}
                    >
                      {option.value}
                    </button>
                  ))}
                </div>
              </div>
              {form.formState.errors.voto_dato && (
                <p className="text-sm text-red-600">{form.formState.errors.voto_dato.message}</p>
              )}
            </div>
            
            {/* Commento */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Commento (opzionale)</label>
              <textarea
                rows={5}
                placeholder="Inserisci commento..."
                value={commento}
                onChange={(e) => setCommento(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[100px]"
              />
              {form.formState.errors.commento && (
                <p className="text-sm text-red-600">{form.formState.errors.commento.message}</p>
              )}
            </div>
            
            {/* Risultato della votazione */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Risultato della votazione *</label>
              <div className="flex justify-center">
                <div className="flex w-full max-w-md">
                  {[
                    { value: "Approvata", color: "bg-green-600 text-white" },
                    { value: "Parità", color: "bg-yellow-500 text-white" },
                    { value: "Respinta", color: "bg-red-600 text-white" }
                  ].map((option, idx) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`flex-1 py-3 text-base font-medium transition-transform duration-150 focus:outline-none border border-gray-200 ${
                        idx === 0 ? 'rounded-l-full' : ''
                      } ${
                        idx === 2 ? 'rounded-r-full' : ''
                      } ${
                        vincitore === option.value 
                          ? option.color + ' scale-95 z-10' 
                          : 'bg-white hover:bg-gray-10 z-0'
                      }`}
                      onClick={() => setVincitore(option.value as "Approvata" | "Parità" | "Respinta")}
                    >
                      {option.value}
                    </button>
                  ))}
                </div>
              </div>
              {form.formState.errors.vincitore && (
                <p className="text-sm text-red-600">{form.formState.errors.vincitore.message}</p>
              )}
            </div>
            
            {/* Pulsante invio */}
            <button
              type="button"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={submitComunicazione.isPending}
              onClick={handleSubmit}
            >
              {submitComunicazione.isPending ? "Invio in corso..." : "Invia Comunicazione"}
            </button>
          </div>
        </CardContent>
      </Card>
    );
  });



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 page-with-navbar">
      <div className="container mx-auto px-4 py-8 pb-24">
        {isAdmin ? (
          // Admin vede solo le sezioni Istituzione
          <div className="space-y-4">
              {/* Sezione Comunica Voti */}
              <ComunicaVotiCard 
                titoloVotazione={titoloVotazione}
                setTitoloVotazione={setTitoloVotazione}
                votiEntries={votiEntries}
                addVotoEntry={addVotoEntry}
                updateVotoEntry={updateVotoEntry}
                removeVotoEntry={removeVotoEntry}
                submitComunicaVoti={submitComunicaVoti}
              />
          </div>
        ) : (
          // Altri utenti vedono solo i riquadri che possono usare
          <div className="space-y-6">
            {canComunicaVoti && (
              <ComunicaVotiCard 
                titoloVotazione={titoloVotazione}
                setTitoloVotazione={setTitoloVotazione}
                votiEntries={votiEntries}
                addVotoEntry={addVotoEntry}
                updateVotoEntry={updateVotoEntry}
                removeVotoEntry={removeVotoEntry}
                submitComunicaVoti={submitComunicaVoti}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default Votazione;
