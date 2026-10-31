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

type GraziaRequest = {
  id: string;
  nome: string;
  urlProva: string | null;
  userId: string;
  createdAt: string;
};

export default function GestisciGrazia() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isAdmin = hasAdminCapability(user);

  const { data: requests = [], isLoading, isError, error } = useQuery<GraziaRequest[]>({
    queryKey: ["graziaRequests"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/grazia/richieste");
      if (!response?.ok || !Array.isArray(response.data)) throw new Error("Coda richieste non disponibile");
      return response.data;
    },
    enabled: !!user && isAdmin,
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
      </div>
    </div>
  );
}
