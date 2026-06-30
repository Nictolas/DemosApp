import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, ThumbsUp, ThumbsDown, MessageSquare, Megaphone, Calendar, BookOpen, Users, Bell, Share2, Home } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { PageContainer } from "@/components/PageContainer";
import { usePreferitiHeaderHeight } from "@/pages/Preferiti/usePreferitiHeaderHeight";

const comunicaSchema = z.object({
  titolo: z.string().min(1, "Il titolo è obbligatorio"),
  voto_dato: z.enum(["Favorevole", "Contrario", "Astenuto"], {
    required_error: "Seleziona il tuo voto",
  }),
  commento: z.string().max(20, "Il commento non può superare i 20 caratteri").optional(),
  vincitore: z.enum(["Favorevole", "Contrario", "Astenuto"], {
    required_error: "Seleziona il vincitore",
  }),
});

const eventoSchema = z.object({
  dove: z.string().min(1, "Il luogo è obbligatorio"),
  quando: z.string().min(1, "La data è obbligatoria"),
});

type ComunicaFormData = z.infer<typeof comunicaSchema>;
type EventoFormData = z.infer<typeof eventoSchema>;

interface ExistingComunicazione {
  titolo: string;
  vincitore: string;
  zona: string;
}

export default function Strumenti() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { pageRef, headerRef } = usePreferitiHeaderHeight("--strumenti-header-h");
  const [existingComunicazione, setExistingComunicazione] = useState<ExistingComunicazione | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const form = useForm<ComunicaFormData>({
    resolver: zodResolver(comunicaSchema),
    defaultValues: {
      titolo: "",
      voto_dato: undefined,
      commento: "",
      vincitore: undefined,
    },
  });

  const eventoForm = useForm<EventoFormData>({
    resolver: zodResolver(eventoSchema),
    defaultValues: {
      dove: "",
      quando: "",
    },
  });

  // Get user's last communication
  const { data: ultimaComunicazione } = useQuery({
    queryKey: ["/api/ultima-comunicazione", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await apiRequest("GET", `/api/comunicazioni/ultima-comunicazione?user_id=${user.id}`);
      if (!response.ok) {
        if (response.status === 404) return null; // No previous communication
        throw new Error('Failed to fetch last communication');
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Generate zona based on user's election data
  const generateZona = () => {
    if (!user) return "";
    
    const { grado_elezione, comune_elezione, provincia_elezione, regione_elezione, paese_elezione } = user as any;
    
    if (grado_elezione === "CO" && comune_elezione) {
      return `Comune di ${comune_elezione}`;
    } else if (grado_elezione === "P" && provincia_elezione) {
      return `Provincia di ${provincia_elezione}`;
    } else if (grado_elezione === "R" && regione_elezione) {
      return `Regione ${regione_elezione}`;
    } else if (grado_elezione === "N" && paese_elezione) {
      return `Parlamento ${paese_elezione === "Italia" ? "Italiano" : paese_elezione}`;
  } else if (grado_elezione === "E") {
    return "Parlamento Europeo";
  }
    
    return "Zona non specificata";
  };

  // Check for existing comunicazione
  const checkDuplicate = async (titolo: string) => {
    if (!titolo.trim()) return;
    
    setCheckingDuplicate(true);
    try {
      const zona = generateZona();
      const response = await apiRequest("GET", `/api/comunicazioni/check-duplicate?titolo=${encodeURIComponent(titolo)}&zona=${encodeURIComponent(zona)}`);
      const data = await response.json();
      
      if (data.exists) {
        setExistingComunicazione(data.comunicazione);
        form.setValue("vincitore", data.comunicazione.vincitore);
      } else {
        setExistingComunicazione(null);
      }
    } catch (error) {
      console.error("Errore nel controllo duplicati:", error);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  // Submit comunicazione
  const submitComunicazione = useMutation({
    mutationFn: async (data: ComunicaFormData) => {
      const zona = generateZona();
      const comunicazioneData = {
        ...data,
        zona,
        isDuplicate: !!existingComunicazione,
      };
      
      const response = await apiRequest("POST", "/api/comunicazioni", comunicazioneData);
      
      if (!response.ok) {
        throw new Error("Errore nell'invio della comunicazione");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Comunicazione inviata",
        description: "La tua comunicazione è stata registrata con successo.",
      });
      form.reset();
      setExistingComunicazione(null);
      // Naviga al menu con un breve delay per mostrare il toast
      setTimeout(() => {
        setLocation("/menu");
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore nell'invio della comunicazione.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ComunicaFormData) => {
    submitComunicazione.mutate(data);
  };

  // Submit nuovo evento
  const submitEvento = useMutation({
    mutationFn: async (data: EventoFormData) => {
      const response = await apiRequest("POST", "/api/eventi", data);
      
      if (!response.ok) {
        throw new Error("Errore nell'invio del evento");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Evento programmato",
        description: "Il tuo evento è stato programmato con successo.",
      });
      eventoForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore nella programmazione del evento.",
        variant: "destructive",
      });
    },
  });

  const onSubmitEvento = (data: EventoFormData) => {
    submitEvento.mutate(data);
  };

  // Show loading while user data is being fetched
  if (!user) {
    return (
      <PageContainer className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Caricamento dati utente...</p>
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Check if user has the right role for advanced features
  // Use the user object from useAuth() which should contain the ruolo field
  const userRole = user?.ruolo;
  // Permetti l'accesso anche agli utenti Istituzione (I), Attivista (A) e Organizzazione (O)
  // anche se vedranno solo alcuni pulsanti
  const hasAdvancedAccess = userRole === "P" || userRole === "C" || userRole === "CP" || userRole === "AD" || userRole === "I" || userRole === "A" || userRole === "O";

  // Debug logging
  // Debug logging rimosso per evitare re-render

  // Blocca completamente l'accesso solo per utenti "Elettore" e altri ruoli non autorizzati
  if (!hasAdvancedAccess) {
    return (
      <PageContainer className="bg-gradient-to-br from-purple-50 to-pink-100 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setLocation("/preferiti")}
              className="flex items-center gap-2"
            >
              Torna ai Preferiti
            </Button>
          </div>

          {/* Titolo */}
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                Accesso Negato
              </CardTitle>
              <CardDescription>
                Questa pagina è riservata a Politici, Candidati, Candidati Politici, Admin, Istituzioni, Attivisti e Organizzazioni
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Messaggio di accesso negato */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Accesso negato</AlertTitle>
            <AlertDescription>
              La pagina "Strumenti" è disponibile solo per utenti con ruoli avanzati.
              Il tuo ruolo attuale: {userRole || 'Non definito'}.
              Per accedere a questa pagina, contatta un amministratore per aggiornare il tuo ruolo.
            </AlertDescription>
          </Alert>
        </div>
      </PageContainer>
    );
  }

  // Pulsante Riscontro per Politico/Candidato Politico/Admin
  // Mostra in alto nella pagina
  return (
    <PageContainer
      ref={pageRef}
      className="strumenti-page strumenti-page--anchored bg-gradient-to-br from-purple-50 to-pink-100"
    >
      <div className="strumenti-page__shell">
        <div ref={headerRef} className="strumenti-page__header">
          <Card className="mb-1">
            <CardHeader className="text-center py-3">
              <CardTitle className="flex items-center justify-center gap-2 text-xl sm:text-2xl">
                <Megaphone className="h-6 w-6 text-blue-600" />
                Strumenti
              </CardTitle>
              <CardDescription>
                Accedi agli strumenti di gestione, comunicazione e analisi
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="strumenti-page__scroll">
          <div className="max-w-4xl mx-auto w-full flex flex-col gap-2 py-1">
          {/* Menu (Bacheca) - accesso alla pagina Menu */}
          <button
            type="button"
            className="relative w-full min-h-[5rem] shrink-0 rounded-xl shadow-md active:shadow overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-lg"
            onClick={() => setLocation("/menu")}
            onContextMenu={e => e.preventDefault()}
          >
            <div className="relative z-10 flex items-center justify-between h-full px-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Home className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="flex flex-col items-start">
                  <div className="text-gray-900 font-semibold text-base">Menu</div>
                  <div className="text-gray-600 text-sm">Bacheca, eventi, iniziative e notifiche</div>
                </div>
              </div>
            </div>
          </button>
          {/* Comunica - solo per Istituzione e Admin, NON per Politico/Candidato/Candidato Politico */}
          {(user?.ruolo === "I" || user?.ruolo === "AD") && (
            <button
              type="button"
              className="relative w-full min-h-[5rem] shrink-0 rounded-xl shadow-md active:shadow overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 bg-white border border-gray-200 hover:border-blue-300 hover:shadow-lg"
              onClick={() => setLocation('/comunica')}
              onContextMenu={e => e.preventDefault()}
            >
              <div className="relative z-10 flex items-center justify-between h-full px-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Megaphone className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="text-gray-900 font-semibold text-base">Comunica</div>
                    <div className="text-gray-600 text-sm">Comunica le tue decisioni di voto</div>
                  </div>
                </div>
              </div>
            </button>
          )}
          {/* Informa Cittadini - solo per Istituzione e Admin */}
          {(user?.ruolo === "I" || user?.ruolo === "AD") && (
            <button
              type="button"
              className="relative w-full min-h-[5rem] shrink-0 rounded-xl shadow-md active:shadow overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 bg-white border border-gray-200 hover:border-emerald-300 hover:shadow-lg"
              onClick={() => setLocation('/informa-cittadini')}
              onContextMenu={e => e.preventDefault()}
            >
              <div className="relative z-10 flex items-center justify-between h-full px-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-12 w-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Bell className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="text-gray-900 font-semibold text-base">Informa Cittadini</div>
                    <div className="text-gray-600 text-sm">Invia notifiche ai cittadini</div>
                  </div>
                </div>
              </div>
            </button>
          )}
          {/* Evento (solo per ruoli avanzati) */}
          <button
            type="button"
            className="relative w-full min-h-[5rem] shrink-0 rounded-xl shadow-md active:shadow overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 bg-white border border-gray-200 hover:border-green-300 hover:shadow-lg"
            onClick={() => setLocation('/evento')}
            onContextMenu={e => e.preventDefault()}
          >
            <div className="relative z-10 flex items-center justify-between h-full px-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex flex-col items-start">
                  <div className="text-gray-900 font-semibold text-base">Evento</div>
                  <div className="text-gray-600 text-sm">Crea e gestisci eventi pubblici</div>
                </div>
              </div>
            </div>
          </button>
          {/* Programma (solo Admin/Candidato) */}
          {user?.ruolo === "AD" || user?.ruolo === "C" || user?.ruolo === "CP" ? (
            <button
              type="button"
              className="relative w-full min-h-[5rem] shrink-0 rounded-xl shadow-md active:shadow overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 bg-white border border-gray-200 hover:border-purple-300 hover:shadow-lg"
              onClick={() => setLocation('/programma')}
              onContextMenu={e => e.preventDefault()}
            >
              <div className="relative z-10 flex items-center justify-between h-full px-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="text-gray-900 font-semibold text-base">Programma</div>
                    <div className="text-gray-600 text-sm">Il tuo programma personale</div>
                  </div>
                </div>
              </div>
            </button>
          ) : null}
          {/* Sostenitori (Politico/Candidato/Admin/Attivista/Organizzazione, NON Istituzione) */}
          {(user?.ruolo === "P" || user?.ruolo === "C" || user?.ruolo === "CP" || user?.ruolo === "AD" || user?.ruolo === "A" || user?.ruolo === "O") && (
            <button
              type="button"
              className="relative w-full min-h-[5rem] shrink-0 rounded-xl shadow-md active:shadow overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 bg-white border border-gray-200 hover:border-pink-300 hover:shadow-lg"
              onClick={() => setLocation('/sostenitori')}
              onContextMenu={e => e.preventDefault()}
            >
              <div className="relative z-10 flex items-center justify-between h-full px-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-12 w-12 rounded-lg bg-pink-100 flex items-center justify-center">
                    <Users className="h-6 w-6 text-pink-600" />
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="text-gray-900 font-semibold text-base">Sostenitori</div>
                    <div className="text-gray-600 text-sm">Dati su chi ti ha scelto</div>
                  </div>
                </div>
              </div>
            </button>
          )}
          {/* Riscontro (solo per Politico/Candidato/Admin, NON per Attivista/Organizzazione) */}
          {(user?.ruolo === "P" || user?.ruolo === "C" || user?.ruolo === "CP" || user?.ruolo === "AD") && (
            <button
              type="button"
              className="relative w-full min-h-[5rem] shrink-0 rounded-xl shadow-md active:shadow overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-lg"
              onClick={() => setLocation('/riscontro')}
              onContextMenu={e => e.preventDefault()}
            >
              <div className="relative z-10 flex items-center justify-between h-full px-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="text-gray-900 font-semibold text-base">Riscontro</div>
                    <div className="text-gray-600 text-sm">Feedback sulle tue decisioni</div>
                  </div>
                </div>
              </div>
            </button>
          )}
          {/* Sondaggi (solo per Politico/Candidato/Admin, NON per Attivista/Organizzazione) */}
          {(user?.ruolo === "P" || user?.ruolo === "C" || user?.ruolo === "CP" || user?.ruolo === "AD") && (
            <button
              type="button"
              className="relative w-full min-h-[5rem] shrink-0 rounded-xl shadow-md active:shadow overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 bg-white border border-gray-200 hover:border-yellow-300 hover:shadow-lg"
              onClick={() => setLocation('/sondaggi')}
              onContextMenu={e => e.preventDefault()}
            >
              <div className="relative z-10 flex items-center justify-between h-full px-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-12 w-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="text-gray-900 font-semibold text-base">Sondaggi</div>
                    <div className="text-gray-600 text-sm">Vedi le opinioni dei cittadini</div>
                  </div>
                </div>
              </div>
            </button>
          )}
          {/* Social (solo per Attivista e Admin) */}
          {(user?.ruolo === "A" || user?.ruolo === "AD") && (
            <button
              type="button"
              className="relative w-full min-h-[5rem] shrink-0 rounded-xl shadow-md active:shadow overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 bg-white border border-gray-200 hover:border-amber-300 hover:shadow-lg"
              onClick={() => setLocation('/social')}
              onContextMenu={e => e.preventDefault()}
            >
              <div className="relative z-10 flex items-center justify-between h-full px-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Share2 className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="text-gray-900 font-semibold text-base">Social</div>
                    <div className="text-gray-600 text-sm">Inserisci il tuo sito e profili social</div>
                  </div>
                </div>
              </div>
            </button>
          )}
        {/* Ultima Votazione Section - Compatta */}
        {ultimaComunicazione?.comunicazione && (
          <Card className="shrink-0 mt-2">
            <CardHeader className="py-2">
              <CardTitle className="text-sm font-bold">Ultima Votazione</CardTitle>
              <CardDescription className="text-xs">
                La tua ultima comunicazione inviata
              </CardDescription>
            </CardHeader>
            <CardContent className="py-2">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 space-y-1 text-xs">
                <div>
                  <span className="font-medium">Titolo:</span>
                  <p className="text-sm mt-1">{ultimaComunicazione.comunicazione.titolo}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-sm">Il tuo voto:</span>
                    <Badge 
                      variant="outline" 
                      className={`ml-2 ${
                        ultimaComunicazione.comunicazione.voto_dato === "Favorevole" 
                          ? "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                          : ultimaComunicazione.comunicazione.voto_dato === "Contrario"
                          ? "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
                          : "border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400"
                      }`}
                    >
                      {ultimaComunicazione.comunicazione.voto_dato}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium text-sm">Risultato:</span>
                    <Badge 
                      variant="outline" 
                      className={`ml-2 ${
                        ultimaComunicazione.comunicazione.vincitore === "Favorevole" 
                          ? "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                          : ultimaComunicazione.comunicazione.vincitore === "Contrario"
                          ? "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
                          : "border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400"
                      }`}
                    >
                      {ultimaComunicazione.comunicazione.vincitore}
                    </Badge>
                  </div>
                </div>
                {ultimaComunicazione.comunicazione.commento && (
                  <div>
                    <span className="font-medium text-sm">Commento:</span>
                    <p className="text-sm mt-1 italic">"{ultimaComunicazione.comunicazione.commento}"</p>
                  </div>
                )}
                <div>
                  <span className="font-medium text-sm">Zona:</span>
                  <p className="text-sm mt-1">{ultimaComunicazione.comunicazione.zona}</p>
                </div>
                <div>
                  <span className="font-medium text-sm">Data:</span>
                  <p className="text-sm mt-1">
                    {new Date(ultimaComunicazione.comunicazione.data_creazione).toLocaleDateString('it-IT', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                  <span className="font-medium text-sm">Feedback ricevuto:</span>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <ThumbsUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">{ultimaComunicazione.comunicazione.likes || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <ThumbsDown className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">{ultimaComunicazione.comunicazione.dislikes || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
