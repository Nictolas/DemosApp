import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";

interface ProgrammaData {
  proposta1: string;
  proposta2: string;
  proposta3: string;
  proposta4: string;
  proposta5: string;
  url1: string;
  url2: string;
  url3: string;
  url4: string;
  url5: string;
}

interface ProgrammaContext extends ProgrammaData {
  candidacy_id?: string | null;
  election_event_id?: string | null;
  jurisdiction?: {
    level?: string;
    country?: string;
    region?: string;
    province?: string;
    municipality?: string;
  } | null;
  has_program?: boolean;
}

const defaultValues: ProgrammaData = {
  proposta1: "",
  proposta2: "",
  proposta3: "",
  proposta4: "",
  proposta5: "",
  url1: "",
  url2: "",
  url3: "",
  url4: "",
  url5: "",
};

function candidacyLabel(context: ProgrammaContext, index: number) {
  const jurisdiction = context.jurisdiction || {};
  const place = jurisdiction.municipality || jurisdiction.region || jurisdiction.country;
  const level = jurisdiction.level;
  const details = [level, place].filter(Boolean).join(" · ");
  return details ? `Candidatura ${index + 1} · ${details}` : `Candidatura ${index + 1}`;
}

export default function Programma() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<ProgrammaData>({ defaultValues });
  const [selectedCandidacyId, setSelectedCandidacyId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["programmaData", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const contextResponse = await apiRequest("GET", "/api/programma/edit-context");
      if (contextResponse.ok && contextResponse.data?.success && contextResponse.data.canonical) {
        const contexts = (contextResponse.data.contexts || []) as ProgrammaContext[];
        return {
          canonical: true,
          contexts,
          programma: contexts.length === 1 ? contexts[0] : defaultValues,
        };
      }

      try {
        const response = await apiRequest("GET", `/api/programma/${user.id}`);
        if (response.ok && response.data?.success) {
          return {
            canonical: false,
            contexts: [] as ProgrammaContext[],
            programma: response.data.data || defaultValues,
          };
        }
      } catch (error: any) {
        if (!(error.status === 404 || error.message?.includes("404") || error.message?.includes("non trovato"))) {
          throw error;
        }
      }

      return {
        canonical: false,
        contexts: [] as ProgrammaContext[],
        programma: defaultValues,
      };
    },
    enabled: !!user,
  });

  const contexts = data?.contexts || [];

  useEffect(() => {
    if (!data?.canonical) {
      setSelectedCandidacyId("");
      return;
    }

    if (contexts.length === 1) {
      setSelectedCandidacyId(contexts[0].candidacy_id || "");
    } else if (
      contexts.length > 1 &&
      !contexts.some((context) => context.candidacy_id === selectedCandidacyId)
    ) {
      setSelectedCandidacyId("");
    }
  }, [data?.canonical, contexts, selectedCandidacyId]);

  const selectedContext = data?.canonical
    ? contexts.find((context) => context.candidacy_id === selectedCandidacyId) ||
      (contexts.length === 1 ? contexts[0] : null)
    : null;

  useEffect(() => {
    if (data?.canonical) {
      form.reset(selectedContext || defaultValues);
    } else if (data?.programma) {
      form.reset(data.programma);
    }
  }, [data?.canonical, data?.programma, selectedContext, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: ProgrammaData) => {
      if (data?.canonical && !selectedContext?.candidacy_id) {
        throw new Error("Seleziona la candidatura a cui associare il Programma.");
      }

      const response = await apiRequest("POST", "/api/programma", {
        utente_id: user?.id,
        candidacy_id: data?.canonical ? selectedContext?.candidacy_id : undefined,
        proposta_1: values.proposta1,
        proposta_2: values.proposta2,
        proposta_3: values.proposta3,
        proposta_4: values.proposta4,
        proposta_5: values.proposta5,
        url_1: values.url1,
        url_2: values.url2,
        url_3: values.url3,
        url_4: values.url4,
        url_5: values.url5,
      });

      if (!response.ok) {
        throw new Error(response.data?.message || response.data?.error || "Impossibile salvare il Programma.");
      }
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Salvato", description: "Il Programma è stato aggiornato." });
      queryClient.invalidateQueries({ queryKey: ["programmaData", user?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare il Programma.",
        variant: "destructive",
      });
    },
  });

  if (isAuthLoading || (user && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) return <Redirect to="/auth" />;

  const canEdit = Boolean(
    user.capabilities?.isAdmin ||
      user.capabilities?.isCandidate ||
      user.capabilities?.isPolitician ||
      ["AD", "P", "C", "CP"].includes(user.ruolo || ""),
  );

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 flex items-center justify-center page-with-navbar">
        <Card>
          <CardHeader>
            <CardTitle>Accesso negato</CardTitle>
            <CardDescription>Il Programma è disponibile solo per Candidati e Politici.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const requiresSelection = Boolean(data?.canonical && contexts.length > 1);
  const hasEditableCandidacy = !data?.canonical || contexts.length > 0;
  const saveDisabled =
    saveMutation.isPending ||
    !hasEditableCandidacy ||
    (requiresSelection && !selectedCandidacyId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 page-with-navbar">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Programma Elettorale</CardTitle>
            <CardDescription>
              Inserisci le cinque proposte principali del Programma associato alla candidatura.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data?.canonical && contexts.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Non risulta una candidatura attiva a cui associare un Programma.
              </p>
            ) : (
              <form
                className="space-y-6"
                onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
              >
                {requiresSelection && (
                  <div className="space-y-2">
                    <label className="block font-medium" htmlFor="programma-candidacy">
                      Candidatura
                    </label>
                    <select
                      id="programma-candidacy"
                      value={selectedCandidacyId}
                      onChange={(event) => setSelectedCandidacyId(event.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Seleziona una candidatura</option>
                      {contexts.map((context, index) => (
                        <option key={context.candidacy_id || index} value={context.candidacy_id || ""}>
                          {candidacyLabel(context, index)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedContext?.candidacy_id && contexts.length === 1 && (
                  <p className="text-sm text-muted-foreground">
                    {candidacyLabel(selectedContext, 0)}
                  </p>
                )}

                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div>
                      <label className="block font-medium mb-1">Proposta {n}</label>
                      <Input
                        {...form.register(`proposta${n}` as keyof ProgrammaData)}
                        placeholder={`Scrivi la proposta ${n}...`}
                        disabled={saveMutation.isPending}
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1 text-sm text-gray-600">
                        URL {n} (opzionale)
                      </label>
                      <Input
                        {...form.register(`url${n}` as keyof ProgrammaData)}
                        placeholder={`https://esempio.com/proposta-${n}`}
                        disabled={saveMutation.isPending}
                        className="bg-white"
                        type="url"
                      />
                    </div>
                  </div>
                ))}

                <Button type="submit" className="mt-4" disabled={saveDisabled}>
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    "Salva Programma"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
