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
import { Navbar } from "@/components/Navbar";
import { AlertTriangle, CheckCircle, ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
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
    queryKey: ["/api/users", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const response = await apiRequest("GET", `/api/users/${encodeURIComponent(user.uid)}`);
      if (!response.ok) throw new Error('Failed to fetch user data');
      return response.json();
    },
    enabled: !!user?.email,
  });

  // Get user's last communication
  const { data: ultimaComunicazione } = useQuery({
    queryKey: ["/api/ultima-comunicazione"],
    queryFn: async () => {
      const response = await apiRequest("GET", '/api/ultima-comunicazione');
      if (!response.ok) {
        if (response.status === 404) return null; // No previous communication
        throw new Error('Failed to fetch last communication');
      }
      return response.json();
    },
    enabled: !!user?.email,
  });

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

  // Show loading while userData is being fetched
  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Navbar />
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
        <Navbar />
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Pulsante Riscontro */}
        {(userRole === "Politico" || userRole === "Candidato Politico" || userRole === "Admin") && (
          <div className="flex justify-end mb-2">
            <Button variant="outline" onClick={() => setLocation("/riscontro")}>Riscontro</Button>
          </div>
        )}
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
              Comunica
            </CardTitle>
            <CardDescription>
              Invia comunicazioni, programma eventi o votazioni
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Pulsanti Navigazione */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600 group-hover:text-blue-700">
                Votazione
              </CardTitle>
              <CardDescription>
                Comunica una nuova votazione
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => setLocation('/votazione')}>
                Votazione
              </Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 group-hover:text-green-700">
                Evento
              </CardTitle>
              <CardDescription>
                Programma un nuovo evento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setLocation('/evento')}>
                Evento
              </Button>
            </CardContent>
          </Card>
          {userData?.ruolo === 'Admin' || userData?.ruolo === 'Candidato' || userData?.ruolo === 'Candidato Politico' ? (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-600 group-hover:text-purple-700">
                  Programma
                </CardTitle>
                <CardDescription>
                  Visualizza o modifica il programma
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => setLocation('/programma')}>
                  Programma
                </Button>
              </CardContent>
            </Card>
          ) : null}
          {(userData?.ruolo === 'Politico' || userData?.ruolo === 'Candidato' || userData?.ruolo === 'Candidato Politico' || userData?.ruolo === 'Admin') && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-pink-600 group-hover:text-pink-700">
                  <span className="inline-flex items-center"><svg xmlns='http://www.w3.org/2000/svg' className='h-5 w-5 mr-1' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 20h5v-2a4 4 0 00-3-3.87M9 20h6M3 20h5v-2a4 4 0 013-3.87M16 3.13a4 4 0 010 7.75M8 3.13a4 4 0 010 7.75' /></svg>Sostenitori</span>
                </CardTitle>
                <CardDescription>
                  Visualizza i tuoi sostenitori
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-pink-600 hover:bg-pink-700" onClick={() => setLocation('/sostenitori')}>
                  Sostenitori
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Statistiche Opinioni */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 group-hover:text-green-700">
                <MessageSquare className="h-5 w-5" />
                Statistiche Opinioni
              </CardTitle>
              <CardDescription>
                Analizza le opinioni politiche degli utenti e le tendenze
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => setLocation("/statistiche-opinioni")}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Visualizza Statistiche Opinioni
              </Button>
            </CardContent>
          </Card>
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