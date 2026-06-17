import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, ArrowLeft, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, Redirect } from "wouter";

interface UltimaComunicazione {
  id: string;
  titolo: string;
  likes: number;
  dislikes: number;
  data_creazione: string;
}

export default function Riscontro() {
  const { user, isLoading: isAuthLoading } = useAuth();

  // 1. Caricamento dati con React Query
  const { data: comunicazione, isLoading, isError } = useQuery<UltimaComunicazione | null>({
    queryKey: ['ultimaComunicazione', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await apiRequest("GET", `/api/comunicazioni/ultima-comunicazione?user_id=${user.id}`);
      if (response.status === 404) return null; // Nessuna comunicazione trovata
      if (!response.ok) throw new Error('Errore nel caricamento della comunicazione');
      const result = await response.json();
      return result.data;
    },
    enabled: !!user, // Esegui solo se l'utente è loggato
  });

  if (isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  const canView = user.ruolo === "P" || user.ruolo === "CP" || user.ruolo === "AD";

  if (!canView) {
      return (
          <div className="min-h-screen p-4 flex items-center justify-center">
              <Card>
                  <CardHeader>
                      <CardTitle>Accesso negato</CardTitle>
                      <CardDescription>Non hai i permessi per visualizzare questa pagina.</CardDescription>
                  </CardHeader>
              </Card>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 page-with-navbar">
      <div className="container mx-auto max-w-2xl">
        <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu</Button></Link>
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Riscontro sull'ultima comunicazione</CardTitle>
            <CardDescription>Visualizza i like e i dislike ricevuti per la tua ultima votazione comunicata.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : isError ? (
              <p className="text-red-500">Errore nel caricamento dei dati.</p>
            ) : comunicazione ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Titolo della votazione:</p>
                  <p className="font-semibold text-lg">{comunicazione.titolo}</p>
                  <p className="text-xs text-muted-foreground">
                    Inviata il: {new Date(comunicazione.data_creazione).toLocaleString('it-IT')}
                  </p>
                </div>
                <div className="flex items-center justify-around p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                        <ThumbsUp className="h-8 w-8 text-green-500 mx-auto" />
                        <p className="text-2xl font-bold">{comunicazione.likes || 0}</p>
                        <p className="text-sm text-muted-foreground">Mi piace</p>
                    </div>
                    <div className="text-center">
                        <ThumbsDown className="h-8 w-8 text-red-500 mx-auto" />
                        <p className="text-2xl font-bold">{comunicazione.dislikes || 0}</p>
                        <p className="text-sm text-muted-foreground">Non mi piace</p>
                    </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Non hai ancora inviato comunicazioni.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
