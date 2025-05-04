import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, ArrowLeft, Check, User, ThumbsUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PageTransition } from "@/components/PageTransition";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

interface Candidato {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  grado_candidatura?: string;
  opinioni_comuni: number;
  // Campi per le opinioni
  energia_nucleare?: string;
  sperimentazione_animale?: string;
  legalizzazione_canapa?: string;
  caccia?: string;
  unione_europea?: string;
}

export default function ScegliCandidato() {
  const { categoria } = useParams<{ categoria: string }>();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [candidati, setCandidati] = useState<Candidato[]>([]);
  const [userOpinions, setUserOpinions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selezionando, setSelezionando] = useState(false);
  
  // Titolo visualizzato in base alla categoria
  const getTitolo = (): string => {
    switch (categoria) {
      case "europeo": return "Europeo";
      case "camera": return "Camera";
      case "senato": return "Senato";
      case "regione": return "Regione";
      case "comune": return "Comune";
      default: return "Candidato";
    }
  };
  
  // Campo database in base alla categoria
  const getFieldName = (): string => {
    switch (categoria) {
      case "europeo": return "candidato_europeo";
      case "camera": return "candidato_camera";
      case "senato": return "candidato_senato";
      case "regione": return "candidato_regione";
      case "comune": return "candidato_comune";
      default: return "";
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        // Carica le opinioni dell'utente corrente
        const opinionsResponse = await apiRequest('/api/opinioni', {
          method: 'GET',
        });
        setUserOpinions(opinionsResponse);
        
        // Carica tutti gli utenti con ruolo candidato o politico candidato
        const { data, error } = await supabase
          .from('utenti')
          .select('id, nome, cognome, email, ruolo, grado_candidatura, energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, unione_europea')
          .or('ruolo.eq.Candidato,ruolo.eq.Politico Candidato')
          .eq('grado_candidatura', getTitolo());
        
        if (error) {
          throw new Error(error.message);
        }
        
        if (data) {
          // Calcola le opinioni comuni con l'utente corrente
          const candidatiConOpinioniComuni = data.map(candidato => {
            let opinioniComuni = 0;
            
            if (candidato.energia_nucleare && candidato.energia_nucleare === opinionsResponse.energia_nucleare) {
              opinioniComuni++;
            }
            if (candidato.sperimentazione_animale && candidato.sperimentazione_animale === opinionsResponse.sperimentazione_animale) {
              opinioniComuni++;
            }
            if (candidato.legalizzazione_canapa && candidato.legalizzazione_canapa === opinionsResponse.legalizzazione_canapa) {
              opinioniComuni++;
            }
            if (candidato.caccia && candidato.caccia === opinionsResponse.caccia) {
              opinioniComuni++;
            }
            if (candidato.unione_europea && candidato.unione_europea === opinionsResponse.unione_europea) {
              opinioniComuni++;
            }
            
            return {
              ...candidato,
              opinioni_comuni: opinioniComuni
            };
          });
          
          // Ordina per numero di opinioni comuni (decrescente)
          candidatiConOpinioniComuni.sort((a, b) => b.opinioni_comuni - a.opinioni_comuni);
          
          // Prendi solo i primi 3 candidati
          setCandidati(candidatiConOpinioniComuni.slice(0, 3));
        }
      } catch (error) {
        console.error("Errore durante il recupero dei dati:", error);
        toast({
          title: "Errore",
          description: "Impossibile caricare i candidati.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, categoria, toast]);

  // Funzione per selezionare un candidato
  const selezionaCandidato = async (candidatoId: string) => {
    if (!user) return;
    
    setSelezionando(true);
    try {
      // Crea un oggetto con il campo da aggiornare
      const updateData: Record<string, string> = {
        [getFieldName()]: candidatoId
      };
      
      // Aggiorna i dati dell'utente
      await apiRequest(`/api/users/${user.email}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      
      toast({
        title: "Candidato selezionato",
        description: "Il candidato è stato selezionato con successo.",
        variant: "default",
      });
      
      // Redirect alla pagina delle elezioni
      window.location.href = "/elezioni";
    } catch (error) {
      console.error("Errore durante la selezione del candidato:", error);
      toast({
        title: "Errore",
        description: "Impossibile selezionare il candidato.",
        variant: "destructive",
      });
    } finally {
      setSelezionando(false);
    }
  };

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  if (isLoading || loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Funzione per visualizzare le opinioni del candidato
  const renderOpinioni = (candidato: Candidato) => {
    const opinioniItems = [
      { key: "energia_nucleare", label: "Energia Nucleare" },
      { key: "sperimentazione_animale", label: "Sperimentazione Animale" },
      { key: "legalizzazione_canapa", label: "Legalizzazione Canapa" },
      { key: "caccia", label: "Caccia" },
      { key: "unione_europea", label: "Unione Europea" }
    ];
    
    return (
      <div className="mt-4 space-y-2">
        <h4 className="font-medium text-sm">Opinioni:</h4>
        <div className="space-y-1 text-sm">
          {opinioniItems.map(item => {
            const keyTyped = item.key as keyof Candidato;
            const opinione = candidato[keyTyped] as string;
            const userOpinione = userOpinions?.[item.key];
            const isCommon = opinione && userOpinione && opinione === userOpinione;
            
            return (
              <div key={item.key} className="flex items-center">
                <span className="w-40">{item.label}:</span>
                <span className={isCommon ? "font-medium text-green-600" : ""}>
                  {opinione || "Non specificata"}
                  {isCommon && <ThumbsUp className="inline-block ml-1 h-3 w-3" />}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-2" asChild>
            <Link to="/elezioni">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Indietro
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Scegli Candidato {getTitolo()}</h1>
        </div>
        
        {candidati.length === 0 ? (
          <Card className="w-full max-w-3xl mx-auto mb-6">
            <CardHeader>
              <CardTitle className="text-center">Nessun candidato disponibile</CardTitle>
              <CardDescription className="text-center">
                Non ci sono candidati {getTitolo().toLowerCase()} disponibili al momento.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {candidati.map((candidato) => (
              <Card key={candidato.id} className="w-full">
                <CardHeader>
                  <div className="flex justify-center mb-2">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback>{candidato.nome.charAt(0)}{candidato.cognome.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                  <CardTitle className="text-xl text-center">
                    {candidato.nome} {candidato.cognome}
                  </CardTitle>
                  <div className="flex justify-center space-x-2">
                    <Badge variant="outline">{candidato.ruolo}</Badge>
                    <Badge variant="secondary">
                      {candidato.opinioni_comuni} opinioni comuni
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {renderOpinioni(candidato)}
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    onClick={() => selezionaCandidato(candidato.id)}
                    disabled={selezionando}
                  >
                    {selezionando ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Scegli
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}