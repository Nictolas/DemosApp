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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth-neon";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Loader2, Plus, Trash2, Calculator, Vote, Bell, ChevronDown } from "lucide-react";
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

const demosNotificationSchema = z.object({
  titolo: z.string().min(1, "Il titolo è obbligatorio"),
  commento: z.string().min(1, "Il commento è obbligatorio"),
});

type ComunicaFormData = z.infer<typeof comunicaSchema>;
type ComunicaVotiFormData = z.infer<typeof comunicaVotiSchema>;
type DemosNotificationFormData = z.infer<typeof demosNotificationSchema>;

// Tipologie per la sezione "Informa Cittadini" con emoji
const INFORMA_TIPOLOGIE = [
  { value: "Interruzione erogazione acqua", emoji: "💧" },
  { value: "Acqua non potabile", emoji: "🚱" },
  { value: "Interruzione energia elettrica programmata", emoji: "⚡" },
  { value: "Chiusura strade per lavori", emoji: "🚧" },
  { value: "Modifiche alla viabilità per eventi o manifestazioni", emoji: "🎪" },
  { value: "Pulizia strade (Divieto di sosta temporaneo)", emoji: "🧹" },
  { value: "Disinfestazione zanzare", emoji: "🦟" },
  { value: "Derattizzazione", emoji: "🐀" },
  { value: "Variazioni calendario raccolta rifiuti (es. Festività)", emoji: "🗑️" },
  { value: "Sciopero servizio raccolta rifiuti", emoji: "🚛" },
  { value: "Blocco del traffico per inquinamento (PM10)", emoji: "🌫️" },
  { value: "Chiusura parchi pubblici per vento forte", emoji: "🌳" },
  { value: "Divieto Botti", emoji: "🎆" },
  { value: "Divieto vendita alcolici", emoji: "🚫🍺" },
  { value: "Scadenza IMU", emoji: "🏠" },
  { value: "Scadenza TARI", emoji: "🧾" },
  { value: "Scadenza iscrizione Mensa", emoji: "🍽️" },
  { value: "Scadenza iscrizione Scuolabus", emoji: "🚌" },
  { value: "Pubblicazione Bandi e Concorsi", emoji: "📢" },
  { value: "Avvisi di Protezione Civile (es. rischio incendi, esondazioni)", emoji: "🚨" },
  { value: "Ritrovamento ordigni bellici (Evacuazione)", emoji: "⚠️" },
  { value: "Variazione orari uffici comunali", emoji: "🏛️" },
  { value: "Scuole Chiuse", emoji: "🏫" },
  { value: "Allerta Meteo", emoji: "🌦️" },
] as const;

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

// Card per la sezione "Informa Cittadini"
const InformaCittadiniCard = React.memo(({
  submitInformaCittadini
}: {
  submitInformaCittadini: any;
}) => {
  const [tipologia, setTipologia] = useState<string>("");
  const [dove, setDove] = useState("");
  const [dalGiorno, setDalGiorno] = useState("");
  const [alGiorno, setAlGiorno] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tuttoComune, setTuttoComune] = useState(false);

  const handleSubmit = () => {
    if (!tipologia || (!tuttoComune && !dove.trim()) || !dalGiorno || !alGiorno) {
      return;
    }

    submitInformaCittadini.mutate({
      tipologia,
      dove: tuttoComune ? "Tutto il comune" : dove.trim(),
      dalGiorno,
      alGiorno,
    });
  };

  React.useEffect(() => {
    if (submitInformaCittadini.isSuccess) {
      setTipologia("");
      setDove("");
      setDalGiorno("");
      setAlGiorno("");
      setTuttoComune(false);
      setIsDialogOpen(false);
    }
  }, [submitInformaCittadini.isSuccess]);

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium">Tipologia *</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {INFORMA_TIPOLOGIE.map((tipo) => (
            <Button
              key={tipo.value}
              type="button"
              variant="outline"
              className={`min-h-[6.5rem] rounded-2xl border-0 bg-gradient-to-br text-white text-sm px-2 py-2 flex flex-col items-center justify-center gap-1 transition-all duration-200
                ${tipologia === tipo.value ? "ring-2 ring-emerald-500 scale-95" : "opacity-90 hover:opacity-100 hover:scale-105"}
                ${(() => {
                  switch (tipo.value) {
                    case "Interruzione erogazione acqua":
                    case "Acqua non potabile":
                      return "from-sky-500 to-blue-600";
                    case "Interruzione energia elettrica programmata":
                      return "from-amber-400 to-orange-500";
                    case "Chiusura strade per lavori":
                    case "Modifiche alla viabilità per eventi o manifestazioni":
                      return "from-orange-500 to-red-500";
                    case "Pulizia strade (Divieto di sosta temporaneo)":
                    case "Variazioni calendario raccolta rifiuti (es. Festività)":
                      return "from-emerald-500 to-green-600";
                    case "Disinfestazione zanzare":
                    case "Derattizzazione":
                      return "from-purple-500 to-indigo-600";
                    case "Sciopero servizio raccolta rifiuti":
                      return "from-yellow-400 to-amber-500";
                    case "Blocco del traffico per inquinamento (PM10)":
                    case "Allerta Meteo":
                      return "from-slate-600 to-slate-800";
                    case "Chiusura parchi pubblici per vento forte":
                    case "Scuole Chiuse":
                      return "from-teal-500 to-emerald-600";
                    case "Divieto Botti":
                    case "Divieto vendita alcolici":
                    case "Scadenza IMU":
                    case "Scadenza TARI":
                    case "Scadenza iscrizione Mensa":
                    case "Scadenza iscrizione Scuolabus":
                      return "from-red-600 to-rose-600";
                    case "Pubblicazione Bandi e Concorsi":
                      return "from-indigo-500 to-blue-700";
                    case "Avvisi di Protezione Civile (es. rischio incendi, esondazioni)":
                    case "Ritrovamento ordigni bellici (Evacuazione)":
                      return "from-red-700 to-red-900";
                    case "Variazione orari uffici comunali":
                    default:
                      return "from-gray-500 to-gray-700";
                  }
                })()}`}
              onClick={() => {
                setTipologia(tipo.value);
                setIsDialogOpen(true);
              }}
            >
              <span className="text-3xl leading-none">{tipo.emoji}</span>
              <span className="text-[11px] text-center leading-snug break-words whitespace-normal">
                {tipo.value}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <span>
                {INFORMA_TIPOLOGIE.find(t => t.value === tipologia)?.emoji}
              </span>
              <span>{tipologia || "Informa Cittadini"}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Dove *</label>
              <Input
                type="text"
                placeholder="Es: Via Roma, quartiere Centro Storico"
                value={dove}
                onChange={(e) => setDove(e.target.value)}
                disabled={tuttoComune}
              />
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="tutto-comune"
                  checked={tuttoComune}
                  onCheckedChange={(checked) => {
                    const value = Boolean(checked);
                    setTuttoComune(value);
                    if (value) {
                      setDove("");
                    }
                  }}
                />
                <label
                  htmlFor="tutto-comune"
                  className="text-xs text-gray-700 leading-none cursor-pointer"
                >
                  Tutto il comune
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Dal giorno *</label>
                <Input
                  type="date"
                  value={dalGiorno}
                  onChange={(e) => setDalGiorno(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Al giorno *</label>
                <Input
                  type="date"
                  value={alGiorno}
                  onChange={(e) => setAlGiorno(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={
                submitInformaCittadini.isPending ||
                !tipologia ||
                (!tuttoComune && !dove.trim()) ||
                !dalGiorno ||
                !alGiorno
              }
              onClick={handleSubmit}
            >
              {submitInformaCittadini.isPending ? "Invio in corso..." : "Invia Comunicazione"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

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
  updateVotoEntry: (id: string, field: string, value: string) => void;
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

        {votiEntries.map((entry, index) => (
          <div key={entry.id} className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600">Nome</label>
                  <UserAutocomplete
                    value={entry.nome}
                    onChange={(value) => updateVotoEntry(entry.id, "nome", value)}
                    placeholder="Inserisci nome utente"
                    className="w-full"
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
        ))}
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

  // Mutation per la sezione "Informa Cittadini"
  const submitInformaCittadini = useMutation({
    mutationFn: async (data: {
      tipologia: string;
      dove: string;
      dalGiorno: string;
      alGiorno: string;
    }) => {
      if (!user?.id) {
        throw new Error('ID utente non disponibile. Riprova tra qualche secondo.');
      }

      const payload = {
        tipologia: data.tipologia,
        dove: data.dove,
        dal_giorno: data.dalGiorno,
        al_giorno: data.alGiorno,
        zona: "Generale",
        id_utente: user.id,
      };

      const response = await apiRequest("POST", "/api/informa-cittadini", payload);
      if (!response.ok) {
        throw new Error("Errore nell'invio della comunicazione ai cittadini");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Comunicazione inviata",
        description: "L'avviso ai cittadini è stato registrato con successo.",
      });
      console.log('🔄 Invalidando notificationBadge dopo invio Informa Cittadini');
      queryClient.invalidateQueries({ queryKey: ['notificationBadge'] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore nell'invio della comunicazione.",
        variant: "destructive",
      });
    },
  });
  
  const [isInformaOpen, setIsInformaOpen] = useState(false);
  const [isComunicaVotiOpen, setIsComunicaVotiOpen] = useState(false);

  const form = useForm<ComunicaFormData>({
    resolver: zodResolver(comunicaSchema),
    defaultValues: { titolo: "", voto_dato: "Favorevole", commento: "", vincitore: "Approvata" },
  });

  const demosForm = useForm<DemosNotificationFormData>({
    resolver: zodResolver(demosNotificationSchema),
    defaultValues: { titolo: "", commento: "" },
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

      // Validazione che tutti i nomi siano di utenti esistenti
      for (const entry of validVoti) {
        try {
          const response = await apiRequest("GET", `/api/users/search?q=${encodeURIComponent(entry.nome)}`);
          if (!response.ok) {
            throw new Error(`Errore nella validazione di "${entry.nome}"`);
          }
          
          const data = await response.json();
          const userExists = data.users.some((user: any) => user.displayName === entry.nome);
          
          if (!userExists) {
            throw new Error(`"${entry.nome}" non è un utente registrato. Seleziona un nome dalla lista suggerita.`);
          }
        } catch (error) {
          throw new Error(`Errore nella validazione di "${entry.nome}": ${error.message}`);
        }
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
      console.log('🔄 Invalidando notificationBadge dopo invio comunica voti');
      queryClient.invalidateQueries({ queryKey: ['notificationBadge'] });
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
      console.log('🔄 Invalidando notificationBadge dopo invio notifica Demos');
      queryClient.invalidateQueries({ queryKey: ['notificationBadge'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Invio fallito.", 
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
      console.log('🔄 Invalidando notificationBadge dopo invio comunicazione');
      queryClient.invalidateQueries({ queryKey: ['notificationBadge'] });
      setTimeout(() => setLocation("/menu"), 1000);
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
  const canSendDemosNotifications = userRole === "AD";
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


  // Componente per Notifiche di Demos - memoizzato
  const NotificheDemosCard = React.memo(() => (
    <Card className="w-full bg-white">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
          <Bell className="h-6 w-6" />
          Notifiche di Demos
        </CardTitle>
        <CardDescription className="text-center">
          Invia notifiche a tutti gli utenti dell'applicazione.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...demosForm}>
          <form onSubmit={demosForm.handleSubmit((data) => submitDemosNotification.mutate(data))} className="space-y-4">
            {/* Input semplificati per test */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Titolo della notifica *</label>
              <input
                type="text"
                placeholder="Es: Aggiornamento importante..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                {...demosForm.register("titolo")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Commento *</label>
              <textarea
                rows={5}
                placeholder="Inserisci il messaggio per tutti gli utenti..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[100px]"
                {...demosForm.register("commento")}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitDemosNotification.isPending}>
              {submitDemosNotification.isPending ? "Invio in corso..." : "Invia Notifica a Tutti"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  ));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 page-with-navbar">
      <div className="container mx-auto px-4 py-8 pb-24">
        {isAdmin ? (
          // Admin vede le 2 schede (Istituzione e Notifiche Demos)
          <Tabs defaultValue="comunica-voti" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="comunica-voti" className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Istituzione
              </TabsTrigger>
              <TabsTrigger value="notifiche-demos" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifiche Demos
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="comunica-voti" className="mt-6 space-y-4">
              {/* Sezione Informa Cittadini (collassabile) */}
              <Card className="w-full bg-white">
                <CardHeader 
                  className="flex flex-row items-center justify-between cursor-pointer"
                  onClick={() => setIsInformaOpen(prev => !prev)}
                >
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-lg font-semibold">
                      Informa Cittadini
                    </CardTitle>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-500 transition-transform ${isInformaOpen ? "rotate-180" : ""}`}
                  />
                </CardHeader>
                {isInformaOpen && (
                  <CardContent className="pt-0 pb-6">
                    <InformaCittadiniCard submitInformaCittadini={submitInformaCittadini} />
                  </CardContent>
                )}
              </Card>
              
              {/* Sezione Comunica Voti (collassabile) */}
              <Card className="w-full bg-white">
                <CardHeader 
                  className="flex flex-row items-center justify-between cursor-pointer"
                  onClick={() => setIsComunicaVotiOpen(prev => !prev)}
                >
                  <div className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg font-semibold">
                      Comunica Voti
                    </CardTitle>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-500 transition-transform ${isComunicaVotiOpen ? "rotate-180" : ""}`}
                  />
                </CardHeader>
                {isComunicaVotiOpen && (
                  <CardContent className="pt-0 pb-6">
                    <ComunicaVotiCard 
                      titoloVotazione={titoloVotazione}
                      setTitoloVotazione={setTitoloVotazione}
                      votiEntries={votiEntries}
                      addVotoEntry={addVotoEntry}
                      updateVotoEntry={updateVotoEntry}
                      removeVotoEntry={removeVotoEntry}
                      submitComunicaVoti={submitComunicaVoti}
                    />
                  </CardContent>
                )}
              </Card>
            </TabsContent>
            
            <TabsContent value="notifiche-demos" className="mt-6">
              <NotificheDemosCard />
            </TabsContent>
          </Tabs>
        ) : (
          // Altri utenti vedono solo i riquadri che possono usare
          <div className="space-y-6">
            {canComunicaVoti && (
              <>
                <Card className="w-full bg-white">
                  <CardHeader 
                    className="flex flex-row items-center justify-between cursor-pointer"
                    onClick={() => setIsInformaOpen(prev => !prev)}
                  >
                    <div className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-emerald-600" />
                      <CardTitle className="text-lg font-semibold">
                        Informa Cittadini
                      </CardTitle>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-gray-500 transition-transform ${isInformaOpen ? "rotate-180" : ""}`}
                    />
                  </CardHeader>
                  {isInformaOpen && (
                    <CardContent className="pt-0 pb-6">
                      <InformaCittadiniCard submitInformaCittadini={submitInformaCittadini} />
                    </CardContent>
                  )}
                </Card>

                <Card className="w-full bg-white">
                  <CardHeader 
                    className="flex flex-row items-center justify-between cursor-pointer"
                    onClick={() => setIsComunicaVotiOpen(prev => !prev)}
                  >
                    <div className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-lg font-semibold">
                        Comunica Voti
                      </CardTitle>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-gray-500 transition-transform ${isComunicaVotiOpen ? "rotate-180" : ""}`}
                    />
                  </CardHeader>
                  {isComunicaVotiOpen && (
                    <CardContent className="pt-0 pb-6">
                      <ComunicaVotiCard 
                        titoloVotazione={titoloVotazione}
                        setTitoloVotazione={setTitoloVotazione}
                        votiEntries={votiEntries}
                        addVotoEntry={addVotoEntry}
                        updateVotoEntry={updateVotoEntry}
                        removeVotoEntry={removeVotoEntry}
                        submitComunicaVoti={submitComunicaVoti}
                      />
                    </CardContent>
                  )}
                </Card>
              </>
            )}
            {canSendDemosNotifications && <NotificheDemosCard />}
          </div>
        )}
      </div>
    </div>
  );
});

export default Votazione;
