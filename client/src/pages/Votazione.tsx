import { useState, useEffect } from "react";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, orderBy, limit } from "firebase/firestore";

const comunicaSchema = z.object({
  titolo: z.string().min(1, "Il titolo è obbligatorio"),
  voto_dato: z.enum(["Favorevole", "Contrario", "Astenuto"], {
    required_error: "Seleziona il tuo voto",
  }),
  commento: z.string().max(20, "Il commento non può superare i 20 caratteri").optional(),
  vincitore: z.enum(["Approvata", "Respinta"], {
    required_error: "Seleziona il risultato",
  }),
});

type ComunicaFormData = z.infer<typeof comunicaSchema>;

interface ExistingComunicazione {
  titolo: string;
  vincitore: string;
  zona: string;
}

export default function Votazione() {
  const { user } = useAuth();
  const { toast } = useToast();
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

  // Get complete user data including role
  const { data: userData } = useQuery({
    queryKey: ["/api/users", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const response = await fetch(`/api/users/${encodeURIComponent(user.uid)}`);
      if (!response.ok) throw new Error('Failed to fetch user data');
      return response.json();
    },
    enabled: !!user?.email,
  });

  // Recupera l'ultima comunicazione dell'utente
  // const [ultimaComunicazione, setUltimaComunicazione] = useState<any>(null);

  // useEffect(() => {
  //   if (!user) return;
  //   const fetchUltima = async () => {
  //     const q = query(
  //       collection(db, "comunicazioni"),
  //       where("id_utente", "==", user.uid),
  //       orderBy("data_creazione", "desc"),
  //       limit(1)
  //     );
  //     const snap = await getDocs(q);
  //     if (!snap.empty) setUltimaComunicazione(snap.docs[0].data());
  //     else setUltimaComunicazione(null);
  //   };
  //   fetchUltima();
  // }, [user]);

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

  // Controllo duplicati
  const checkDuplicate = async (titolo: string) => {
    if (!titolo.trim()) return;
    setCheckingDuplicate(true);
    try {
      const zona = generateZona();
      const q = query(
        collection(db, "comunicazioni"),
        where("titolo", "==", titolo),
        where("zona", "==", zona)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setExistingComunicazione(snap.docs[0].data());
        form.setValue("vincitore", snap.docs[0].data().vincitore);
      } else {
        setExistingComunicazione(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  // Submit comunicazione su Firestore
  const submitComunicazione = useMutation({
    mutationFn: async (data: ComunicaFormData) => {
      const zona = generateZona();
      const comunicazioneData = {
        ...data,
        zona,
        id_utente: user.uid,
        nome: userData?.nome,
        cognome: userData?.cognome,
        ruolo: userData?.ruolo,
        data_creazione: new Date().toISOString(),
        punti_trasparenza: existingComunicazione ? 1 : 3,
        likes: 0,
        dislikes: 0,
      };
      // Salva direttamente su Firestore
      await addDoc(collection(db, "comunicazioni"), comunicazioneData);
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Comunicazione inviata",
        description: "La tua comunicazione è stata registrata con successo.",
      });
      form.reset();
      setExistingComunicazione(null);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Ultima Votazione Section */}
        {/*
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
                  <Badge variant="outline" className={`ml-2 ${
                    ultimaComunicazione.vincitore === "Approvata"
                      ? "bg-green-500 text-white border-green-500"
                      : "bg-red-500 text-white border-red-500"
                  }`}>
                    {ultimaComunicazione.vincitore}
                  </Badge>
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
                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                  <span className="font-medium text-sm">Feedback ricevuto:</span>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <span className="text-sm font-medium">{ultimaComunicazione.likes || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-sm font-medium">{ultimaComunicazione.dislikes || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        */}

        {/* Nuova Comunicazione Section */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Nuova Comunicazione</CardTitle>
            <CardDescription className="text-center">
              Condividi i dettagli di una votazione con i tuoi elettori
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {existingComunicazione && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Votazione già comunicata</AlertTitle>
                <AlertDescription>
                  Questa votazione è già stata comunicata per la zona "{existingComunicazione.zona}".
                  <br />
                  <strong>Titolo:</strong> {existingComunicazione.titolo}
                  <br />
                  <strong>Vincitore:</strong> {existingComunicazione.vincitore}
                  <br />
                  Puoi comunque indicare il tuo voto.
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="titolo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titolo della votazione *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Es: Approvazione legge finanziaria 2024"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            checkDuplicate(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="voto_dato"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Il tuo voto *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona il tuo voto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Favorevole">Favorevole</SelectItem>
                          <SelectItem value="Contrario">Contrario</SelectItem>
                          <SelectItem value="Astenuto">Astenuto</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="commento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commento (opzionale)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Breve commento sulla votazione (max 20 caratteri)"
                          {...field}
                          maxLength={20}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vincitore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Risultato della votazione *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona il risultato" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Approvata">Approvata</SelectItem>
                          <SelectItem value="Respinta">Respinta</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={submitComunicazione.isPending || checkingDuplicate}
                >
                  {submitComunicazione.isPending ? "Invio in corso..." : "Invia Comunicazione"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 