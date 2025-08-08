import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, ArrowLeft, Check, User, ThumbsUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/PageTransition";
import { Badge } from "@/components/ui/badge";
import { CustomAvatar } from "@/components/CustomAvatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Candidato {
  id: string;
  nome: string;
  cognome: string;
  ruolo: string;
  opinioni_comuni: number;
  avatar_config?: string;
  energia_nucleare?: string;
  sperimentazione_animale?: string;
  legalizzazione_canapa?: string;
  caccia?: string;
}

interface CandidatiData {
    candidati: Candidato[];
    candidatoSelezionatoId: string | null;
    userOpinions: Record<string, string>;
}

export default function ScegliCandidato() {
  const { categoria } = useParams<{ categoria: string }>();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getTitolo = (): string => {
    switch (categoria) {
      case "europeo": return "Europeo";
      case "camera": return "Camera";
      case "senato": return "Senato";
      case "regione": return "Regione";
      case "comune": return "Comune";
      default: return "";
    }
  };

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

  // 1. Caricamento dati con React Query
  const { data, isLoading, isError } = useQuery<CandidatiData>({
    queryKey: ['candidati', categoria],
    queryFn: async () => {
      if (!user) throw new Error("Utente non autenticato");
      const response = await apiRequest("GET", `/api/candidati?grado=${getTitolo()}&categoria=${categoria}`);
      if (!response.ok) throw new Error("Errore nel caricamento dei candidati");
      return response.json();
    },
    enabled: !!user && !!categoria,
  });

  // 2. Mutazione per selezionare un candidato
  const selectCandidatoMutation = useMutation({
      mutationFn: (candidatoId: string) => {
          return apiRequest("PUT", `/api/users/${user!.uid}/seleziona-candidato`, {
              campo: getFieldName(),
              candidatoId: candidatoId,
          });
      },
      onSuccess: () => {
          toast({ title: "Successo", description: "Candidato selezionato con successo!" });
          queryClient.invalidateQueries({ queryKey: ['candidati', categoria] }); // Ricarica i dati
      },
      onError: (error: any) => {
          toast({ title: "Errore", description: error.message || "Impossibile selezionare il candidato.", variant: "destructive" });
      }
  });

  if (isAuthLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;

  const { candidati = [], candidatoSelezionatoId, userOpinions = {} } = data || {};

  const renderOpinioni = (candidato: Candidato) => {
    const opinioniItems = [{ key: "energia_nucleare", label: "Energia Nucleare" }, { key: "sperimentazione_animale", label: "Sperimentazione Animale" }, { key: "legalizzazione_canapa", label: "Legalizzazione Canapa" }, { key: "caccia", label: "Caccia" }];
    return (
      <div className="mt-4 space-y-2 text-sm">
        <h4 className="font-medium">Opinioni:</h4>
        {opinioniItems.map(item => {
          const key = item.key as keyof Candidato;
          const opinioneCandidato = candidato[key] as string;
          const opinioneUtente = userOpinions[item.key];
          const isCommon = opinioneCandidato && opinioneUtente && opinioneCandidato === opinioneUtente;
          return (
            <div key={item.key} className="flex">
              <span className="w-40">{item.label}:</span>
              <span className={isCommon ? "font-bold text-green-600" : ""}>{opinioneCandidato || "N/D"}{isCommon && <ThumbsUp className="inline ml-1 h-3 w-3" />}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6"><Link to="/elezioni"><Button variant="ghost" className="mr-2"><ArrowLeft className="h-4 w-4 mr-2" />Indietro</Button></Link><h1 className="text-2xl font-bold">Scegli Candidato {getTitolo()}</h1></div>
        
        {isLoading && <div className="flex justify-center py-16"><Loader2 className="h-12 w-12 animate-spin" /></div>}
        {isError && <div className="text-center text-red-500 p-8">Errore nel caricamento dei dati.</div>}
        
        {!isLoading && candidati.length === 0 && (
          <Card><CardHeader><CardTitle className="text-center">Nessun candidato disponibile</CardTitle><CardDescription className="text-center">Non ci sono candidati per {getTitolo().toLowerCase()} nella tua zona.</CardDescription></CardHeader></Card>
        )}

        {!isLoading && candidati.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {candidati.map((candidato) => (
              <Card key={candidato.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex justify-center mb-2">
                    {candidato.avatar_config ? <CustomAvatar config={JSON.parse(candidato.avatar_config)} size={64} /> : <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center"><User/></div>}
                  </div>
                  <CardTitle className="text-xl text-center">{candidato.nome} {candidato.cognome}</CardTitle>
                  <div className="flex justify-center gap-2"><Badge variant="outline">{candidato.ruolo}</Badge><Badge variant="secondary">{candidato.opinioni_comuni} opinioni comuni</Badge></div>
                </CardHeader>
                <CardContent className="flex-grow">{renderOpinioni(candidato)}</CardContent>
                <CardFooter>
                  <Button className="w-full" onClick={() => selectCandidatoMutation.mutate(candidato.id)} disabled={selectCandidatoMutation.isPending || candidato.id === candidatoSelezionatoId}>
                    {candidato.id === candidatoSelezionatoId ? <><Check className="mr-2 h-4 w-4" />Selezionato</> : (selectCandidatoMutation.isPending && selectCandidatoMutation.variables === candidato.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Attendere...</> : "Scegli")}
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