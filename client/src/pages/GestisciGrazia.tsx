import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { hasAdminCapability } from "@/lib/admin-access";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

type PublishedGrazia = { id: string; nome: string; createdAt: string };
type GraziaUnconfirmedWithdrawal = { id: string; withdrawn_at: string };
type GraziaRequest = {
  id: string;
  nome: string;
  urlProva: string | null;
  createdAt: string;
};

export default function GestisciGrazia() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isAdmin = hasAdminCapability(user);
  const [showPublished, setShowPublished] = React.useState(false);
  const [showUnconfirmed, setShowUnconfirmed] = React.useState(false);
  const [withdrawNotes, setWithdrawNotes] = React.useState<Record<string,string>>({});

  const { data: requests = [], isLoading, isError, error } = useQuery<GraziaRequest[]>({
    queryKey: ["graziaRequests"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/grazia/richieste");
      if (!response?.ok || !Array.isArray(response.data)) throw new Error("Coda richieste non disponibile");
      return response.data;
    },
    enabled: !!user && isAdmin,
  });

  const {data: published = [], isLoading: publishedLoading, isError: publishedError} = useQuery<PublishedGrazia[]>({
    queryKey: ["graziaApproved"],
    queryFn: async () => {
      const r=await apiRequest("GET","/api/grazia/approvate");
      if(!r?.ok || !r.data?.success) throw new Error("Pubblicazioni non disponibili");
      return r.data.richieste || [];
    },
    enabled:!!user && isAdmin && showPublished,
  });
  const {data: undelivered=[], isLoading: unconfirmedLoading, isError: unconfirmedError} = useQuery<GraziaUnconfirmedWithdrawal[]>({
    queryKey:["graziaWithdrawalAudit"],
    queryFn:async()=>{
      const r=await apiRequest("GET","/api/grazia/ritiri-avvisi");
      if(!r?.ok || !r.data?.success) throw new Error("Verifica avvisi non disponibile");
      return r.data.ritiri||[];
    },
    enabled:!!user && isAdmin && showUnconfirmed,
  });
  const withdrawMutation=useMutation({
    mutationFn:async({id,note}:{id:string;note:string})=>{
      const r=await apiRequest("POST",`/api/grazia/richiesta/${encodeURIComponent(id)}/ritira`,{note});
      if(!r?.ok || !r.data?.success)throw new Error(r?.data?.error||"Ritiro non riuscito");
      return r.data;
    },
    onSuccess:(result)=>{
      queryClient.invalidateQueries({queryKey:["graziaApproved"]});
      queryClient.invalidateQueries({queryKey:["graziaData"]});
      queryClient.invalidateQueries({queryKey:["graziaWithdrawalAudit"]});
      toast({title:"Pubblicazione Grazia ritirata",
        description:result.notification_sent===true
          ? "I voti storici restano conservati."
          : "Notifica non confermata: verificare gli avvisi con il DPO. Voti storici conservati."});
    },
    onError:(err:Error)=>toast({title:"Ritiro non registrato",description:err.message,variant:"destructive"}),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "accetta" | "rifiuta" }) => {
      const result = await apiRequest("POST", `/api/grazia/richiesta/${encodeURIComponent(id)}/${action}`);
      if (!result?.ok || !result.data?.success) throw new Error(result?.data?.error || "Decisione non applicata");
      return result.data;
    },
    onSuccess: (_data, { action }) => {
      toast({ title: action === "accetta" ? "Proposta approvata" : "Proposta rifiutata" });
      queryClient.invalidateQueries({ queryKey: ["graziaRequests"] });
      queryClient.invalidateQueries({ queryKey: ["graziaData"] });
    },
    onError: (err: Error) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  if (isAuthLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user || !isAdmin) return <Redirect to="/preferiti" />;

  return (
    <div className="page-with-navbar min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-3xl">
        <Button variant="ghost" className="mb-4" onClick={() => setLocation("/gestisci")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Gestisci
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Proposte Grazia da valutare</CardTitle>
            <CardDescription>
              Le persone proposte non sono pubblicate fino all'approvazione.
              Valuta soltanto fonti pubbliche; non raccogliere sentenze o documenti personali.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> :
             isError ? <p className="text-red-600">{(error as Error).message}</p> :
             requests.length === 0 ? <p className="text-muted-foreground">Nessuna proposta in attesa.</p> :
             <div className="space-y-3">
               {requests.map((item) => (
                 <div key={item.id} className="rounded-lg border p-3">
                   <p className="font-medium">{item.nome}</p>
                   {item.urlProva && (
                     <a href={item.urlProva} target="_blank" rel="noopener noreferrer"
                       className="block break-all text-sm text-blue-700 underline">
                       Consulta la fonte pubblica
                     </a>
                   )}
                   <div className="mt-2 flex flex-wrap gap-2">
                     <Button variant="outline" size="sm" disabled={actionMutation.isPending}
                       onClick={() => actionMutation.mutate({ id: item.id, action: "accetta" })}>
                       <Check className="mr-1 h-4 w-4" /> Approva
                     </Button>
                     <Button variant="destructive" size="sm" disabled={actionMutation.isPending}
                       onClick={() => actionMutation.mutate({ id: item.id, action: "rifiuta" })}>
                       <X className="mr-1 h-4 w-4" /> Rifiuta
                     </Button>
                   </div>
                 </div>
               ))}
             </div>}
          </CardContent>
        </Card>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowPublished(value => !value)}>
            {showPublished ? "Nascondi pubblicate" : "Verifica proposte Grazia pubblicate"}
          </Button>
          <Button variant="outline" onClick={() => setShowUnconfirmed(value => !value)}>
            {showUnconfirmed ? "Nascondi avvisi" : "Verifica avvisi di ritiro"}
          </Button>
        </div>
        {showPublished && (
          <Card className="mt-3">
            <CardHeader>
              <CardTitle>Pubblicazioni Grazia da gestire</CardTitle>
              <CardDescription>
                Solo richieste approvate nella coda Grazia. Il ritiro disattiva la voce dal catalogo,
                ma conserva i voti storici e registra motivazione e autore.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {publishedLoading ? <p>Caricamento...</p> : publishedError
                ? <p role="alert">Pubblicazioni temporaneamente non disponibili.</p>
                : published.length === 0
                  ? <p>Nessuna proposta approvata gestibile in questa coda.</p>
                  : published.map(item => (
                    <article key={item.id} className="space-y-2 rounded-lg border p-3">
                      <p className="font-medium">{item.nome}</p>
                      <Input maxLength={500} value={withdrawNotes[item.id]||""}
                        aria-label={"Motivazione del ritiro Grazia di "+item.nome}
                        placeholder="Motivazione del ritiro, senza dati personali"
                        onChange={e=>setWithdrawNotes(previous=>({...previous,[item.id]:e.target.value}))}/>
                      <Button variant="destructive" disabled={withdrawMutation.isPending}
                        onClick={()=>{
                          const note=(withdrawNotes[item.id]||"").trim();
                          if(note.length<3||note.length>500){
                            toast({title:"Inserisci una motivazione da 3 a 500 caratteri",variant:"destructive"});
                            return;
                          }
                          if(window.confirm("Ritirare la pubblicazione Grazia? I voti storici resteranno conservati."))
                            withdrawMutation.mutate({id:item.id,note});
                        }}>
                        <X className="mr-2 h-4 w-4"/> Ritira pubblicazione Grazia
                      </Button>
                    </article>
                  ))}
            </CardContent>
          </Card>
        )}
        {showUnconfirmed && (
          <Card className="mt-3">
            <CardHeader>
              <CardTitle>Avvisi di ritiro Grazia da verificare</CardTitle>
              <CardDescription>
                Caricati solo su richiesta dell'Admin. Un avviso non confermato non prova
                la mancata consegna: verificare con il DPO, senza reinvio automatico.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {unconfirmedLoading ? <p>Caricamento...</p> : unconfirmedError
                ? <p role="alert">Verifica avvisi non disponibile.</p>
                : undelivered.length === 0 ? <p>Nessun avviso da verificare.</p>
                : undelivered.map(item => (
                  <p key={item.id} className="break-all rounded-md border p-2 text-sm">
                    Riferimento ritiro: {item.id}
                  </p>
                ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
