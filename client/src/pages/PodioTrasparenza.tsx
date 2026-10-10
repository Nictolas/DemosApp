import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Medal, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const LEVELS = [
  ["EUROPEO", "Europeo", "rappresentante_europeo"],
  ["CAMERA", "Camera", "rappresentante_camera"],
  ["SENATO", "Senato", "rappresentante_senato"],
  ["REGIONE", "Regione", "rappresentante_regionale"],
  ["COMUNE", "Comune", "rappresentante_comune"],
] as const;

type Level = (typeof LEVELS)[number][0];

interface PodioPolitico {
  id_utente: string;
  nome: string;
  cognome: string;
  numero_voti: number;
  ultimo_voto: string | null;
  posizione: number;
}

interface PodioResponse {
  success: boolean;
  window_days: number;
  max_per_level: number;
  levels: Record<Level, PodioPolitico[]>;
}

const rankIcon = (position: number) => {
  if (position === 1) return <Trophy className="h-5 w-5" />;
  if (position === 2) return <Medal className="h-5 w-5" />;
  if (position === 3) return <Award className="h-5 w-5" />;
  return <span className="w-5 text-center font-semibold">{position}</span>;
};

export default function PodioTrasparenza() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<PodioResponse>({
    queryKey: ["/api/podio-trasparenza"],
  });

  const selectRepresentative = useMutation({
    mutationFn: async ({ politicianId, field }: { politicianId: string; field: string }) => {
      if (!user?.id) throw new Error("Utente non autenticato");
      return apiRequest("PUT", `/api/users/${user.id}/seleziona-rappresentante`, {
        campo: field,
        rappresentanteId: politicianId,
        source: "podio",
      });
    },
    onSuccess: () => {
      toast({
        title: "Rappresentante scelto",
        description: "La tua scelta è stata aggiornata.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rappresentanti"] });
    },
    onError: (mutationError: any) => {
      const code = mutationError?.data?.error;
      const description =
        code === "OPINIONI_INCOMPLETE"
          ? "Completa prima tutte le Opinioni di questo livello."
          : mutationError?.data?.message || mutationError?.message || "Selezione non disponibile.";
      toast({ title: "Impossibile selezionare", description, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="page-with-navbar container mx-auto px-4 py-8">
        <p className="text-center text-muted-foreground">Caricamento Podio di Trasparenza...</p>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="page-with-navbar container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6 text-center text-muted-foreground">
            Il Podio di Trasparenza non è al momento disponibile.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-with-navbar container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Podio di Trasparenza</h1>
          <p className="mt-2 text-muted-foreground">
            Classifica dei politici che hanno rendicontato più voti e decisioni istituzionali negli ultimi 90 giorni.
          </p>
        </div>

        <Tabs defaultValue="EUROPEO">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
            {LEVELS.map(([level, label]) => (
              <TabsTrigger key={level} value={level}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {LEVELS.map(([level, label, field]) => {
            const politicians = data.levels[level] || [];
            return (
              <TabsContent key={level} value={level} className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {politicians.length === 0 ? (
                      <p className="py-8 text-center text-muted-foreground">
                        Nessun voto istituzionale comunicato negli ultimi 90 giorni per questo livello.
                      </p>
                    ) : (
                      <div className="divide-y">
                        {politicians.map((politician) => (
                          <div
                            key={`${level}-${politician.id_utente}`}
                            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
                                {rankIcon(politician.posizione)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold">
                                  {politician.nome} {politician.cognome}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {politician.numero_voti} {politician.numero_voti === 1 ? "voto comunicato" : "voti comunicati"}
                                  {politician.ultimo_voto
                                    ? ` · ultimo ${new Date(politician.ultimo_voto).toLocaleDateString("it-IT")}`
                                    : ""}
                                </p>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={selectRepresentative.isPending}
                              onClick={() =>
                                selectRepresentative.mutate({
                                  politicianId: politician.id_utente,
                                  field,
                                })
                              }
                            >
                              Scegli come rappresentante
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>

        <p className="text-center text-xs text-muted-foreground">
          Contano soltanto voti e decisioni istituzionali comunicati tramite DEMOS. Comizi, eventi e altre comunicazioni non incidono sulla classifica.
        </p>
      </div>
    </div>
  );
}
