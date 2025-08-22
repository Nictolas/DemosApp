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
import { useAuth } from "@/hooks/use-auth-neon";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, ThumbsUp, ThumbsDown, MessageSquare, Megaphone, Calendar, BookOpen, Users } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

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

export default function Comunica() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
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

  // Get complete user data including role
  const { data: userData } = useQuery({
    queryKey: ["/api/utenti/me", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const response = await apiRequest("GET", `/api/utenti/me`);
      if (!response.ok) throw new Error('Failed to fetch user data');
      return response.json();
    },
    enabled: !!user?.email,
  });

  // Get user's last communication - temporaneamente disabilitato
  const ultimaComunicazione = null;

  // Generate zona based on user's election data
  const generateZona = () => {
    if (!userData) return "";
    
    const { grado_elezione, comune_elezione, provincia_elezione, regione_elezione, paese_elezione } = userData as any;
    
    if (grado_elezione === "Comunale" && comune_elezione) {
      return `Comune di ${comune_elezione}`;
    } else if (grado_elezione === "Provinciale" && provincia_elezione) {
      return `Provincia di ${provincia_elezione}`;
    } else if (grado_elezione === "Regionale" && regione_elezione) {
      return `Regione ${regione_elezione}`;
    } else if (grado_elezione === "Nazionale" && paese_elezione) {
      return `Parlamento ${paese_elezione === "Italia" ? "Italiano" : paese_elezione}`;
    } else if (grado_elezione === "Europeo") {
      return "Parlamento Europeo";
    }
    
    return "Zona non specificata";
  };

  // Check for existing comunicazione - temporaneamente disabilitato
  const checkDuplicate = async (titolo: string) => {
    // TODO: Implementare endpoint /api/comunicazioni/check-duplicate
    console.log("Controllo duplicati temporaneamente disabilitato");
  };

  // Submit comunicazione
  const submitComunicazione = useMutation({
    mutationFn: async (data: ComunicaFormData) => {
      // TODO: Implementare endpoint /api/comunicazioni
      throw new Error("Funzionalità comunicazioni non ancora implementata");
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
      // TODO: Implementare endpoint /api/eventi
      throw new Error("Funzionalità eventi non ancora implementata");
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

  // Show loading while userData is being fetched
  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Caricamento dati utente...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if user has the right role
  const userRole = (userData as any)?.ruolo;
  if (!user || (userRole !== "Politico" && userRole !== "Candidato Politico" && userRole !== "Admin")) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Accesso negato</AlertTitle>
            <AlertDescription>
              Questa sezione è accessibile solo ai Politici, ai Candidati Politici e agli Admin. Il tuo ruolo attuale: {userRole || 'Non definito'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Pulsante Riscontro per Politico/Candidato Politico/Admin
  // Mostra in alto nella pagina
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4" style={{ paddingBottom: '80px' }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Pulsante Riscontro */}
        {/* RIMOSSO: Pulsante Riscontro per Politico/Candidato Politico/Admin */}
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setLocation("/menu")}
            className="flex items-center gap-2"
          >
            Torna al Menu
          </Button>
        </div>

        {/* Titolo */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              Strumenti
            </CardTitle>
            <CardDescription>
              Accedi agli strumenti di gestione, comunicazione e analisi
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Pulsanti Navigazione - Nuova estetica */}
        <div className="grid grid-cols-2 gap-6">
          {/* Votazione */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => setLocation('/votazione')}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#dbeafe" />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <Megaphone className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <Megaphone className="h-8 w-8 text-blue-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none">Votazione</div>
            </div>
          </button>
          {/* Evento */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => setLocation('/evento')}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#bbf7d0" />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <Calendar className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <Calendar className="h-8 w-8 text-green-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none">Evento</div>
            </div>
          </button>
          {/* Programma (solo Admin/Candidato) */}
          {userData?.ruolo === 'Admin' || userData?.ruolo === 'Candidato' || userData?.ruolo === 'Candidato Politico' ? (
            <button
              type="button"
              className="relative w-full h-40 rounded-2xl shadow-lg active:shadow overflow-hidden cursor-pointer active:scale-95 transition-transform"
              onClick={() => setLocation('/programma')}
              onContextMenu={e => e.preventDefault()}
            >
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polygon points="100,0 0,0 0,35 100,20" fill="#ede9fe" />
                <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
              </svg>
              <div className="relative z-10 flex flex-col items-center justify-center h-full">
                <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                  <BookOpen className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                  <BookOpen className="h-8 w-8 text-purple-600 relative z-10" />
                </span>
                <div className="text-gray-700 font-semibold text-lg select-none">Programma</div>
              </div>
            </button>
          ) : null}
          {/* Sostenitori (solo Politico/Candidato/Admin) */}
          {(userData?.ruolo === 'Politico' || userData?.ruolo === 'Candidato' || userData?.ruolo === 'Candidato Politico' || userData?.ruolo === 'Admin') && (
            <button
              type="button"
              className="relative w-full h-40 rounded-2xl shadow-lg active:shadow overflow-hidden cursor-pointer active:scale-95 transition-transform"
              onClick={() => setLocation('/sostenitori')}
              onContextMenu={e => e.preventDefault()}
            >
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polygon points="100,0 0,0 0,35 100,20" fill="#fbcfe8" />
                <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
              </svg>
              <div className="relative z-10 flex flex-col items-center justify-center h-full">
                <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                  <Users className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                  <Users className="h-8 w-8 text-pink-600 relative z-10" />
                </span>
                <div className="text-gray-700 font-semibold text-lg select-none">Sostenitori</div>
              </div>
            </button>
          )}
          {/* Riscontro */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => setLocation('/riscontro')}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#c7d2fe" />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <CheckCircle className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <CheckCircle className="h-8 w-8 text-indigo-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none">Riscontro</div>
            </div>
          </button>
          {/* Sondaggi */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => setLocation('/sondaggi')}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#fef9c3" />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <MessageSquare className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <MessageSquare className="h-8 w-8 text-yellow-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none">Sondaggi</div>
            </div>
          </button>
        </div>

        {/* Ultima Votazione Section */}
        {ultimaComunicazione && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-xl font-bold">Ultima Votazione</CardTitle>
              <CardDescription>
                La tua ultima comunicazione inviata
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                <div>
                  <span className="font-medium">Titolo:</span>
                  <p className="text-sm mt-1">{ultimaComunicazione.titolo}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-sm">Il tuo voto:</span>
                    <Badge 
                      variant="outline" 
                      className={`ml-2 ${
                        ultimaComunicazione.voto_dato === "Favorevole" 
                          ? "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                          : ultimaComunicazione.voto_dato === "Contrario"
                          ? "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
                          : "border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400"
                      }`}
                    >
                      {ultimaComunicazione.voto_dato}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium text-sm">Risultato:</span>
                    <Badge 
                      variant="outline" 
                      className={`ml-2 ${
                        ultimaComunicazione.vincitore === "Favorevole" 
                          ? "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                          : ultimaComunicazione.vincitore === "Contrario"
                          ? "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
                          : "border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400"
                      }`}
                    >
                      {ultimaComunicazione.vincitore}
                    </Badge>
                  </div>
                </div>
                {ultimaComunicazione.commento && (
                  <div>
                    <span className="font-medium text-sm">Commento:</span>
                    <p className="text-sm mt-1 italic">"{ultimaComunicazione.commento}"</p>
                  </div>
                )}
                <div>
                  <span className="font-medium text-sm">Zona:</span>
                  <p className="text-sm mt-1">{ultimaComunicazione.zona}</p>
                </div>
                <div>
                  <span className="font-medium text-sm">Data:</span>
                  <p className="text-sm mt-1">
                    {new Date(ultimaComunicazione.data_creazione).toLocaleDateString('it-IT', {
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
                      <span className="text-sm font-medium">{ultimaComunicazione.likes || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <ThumbsDown className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">{ultimaComunicazione.dislikes || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}