import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/api-config";

interface RiconoscimentoRow {
  id: string;
  user_id: string;
  tipo_ruolo: "P" | "C" | "CP";
  nome: string;
  cognome: string;
  email: string;
  paese_elezione: string | null;
  regione_elezione: string | null;
  provincia_elezione: string | null;
  comune_elezione: string | null;
  grado_elezione: string | null;
  paese_candidatura: string | null;
  regione_candidatura: string | null;
  provincia_candidatura: string | null;
  comune_candidatura: string | null;
  grado_candidatura: string | null;
  fonte_elezione_url: string | null;
  fonte_candidatura_url: string | null;
  status: "pending" | "approved" | "rejected";
  identity_status: string | null;
  identity_provider: string | null;
  created_at: string;
  ruolo_corrente: string | null;
}

async function fetchRiconoscimenti(): Promise<RiconoscimentoRow[]> {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    throw new Error("Token mancante");
  }

  const res = await fetch(getApiUrl("/riconoscimenti"), {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || body?.error || "Errore nel caricare i riconoscimenti");
  }

  const data = await res.json();
  return data.data || [];
}

async function actionOnRiconoscimento(id: string, action: "approve" | "reject") {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    throw new Error("Token mancante");
  }

  const res = await fetch(getApiUrl(`/riconoscimenti/${id}/${action}`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Errore durante ${action === "approve" ? "l'approvazione" : "il rifiuto"} della richiesta`);
  }
}

export default function Riconoscimenti() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = user?.ruolo === "AD" || user?.role === "AD";

  const { data, isLoading, isError, error } = useQuery<RiconoscimentoRow[]>({
    queryKey: ["riconoscimenti"],
    queryFn: fetchRiconoscimenti,
    enabled: isAdmin
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => actionOnRiconoscimento(id, "approve"),
    onSuccess: () => {
      toast({
        title: "Richiesta approvata",
        description: "Il ruolo è stato aggiornato e la decisione è disponibile all'utente.",
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ["riconoscimenti"] });
    },
    onError: (err: any) => {
      toast({
        title: "Errore",
        description: err?.message || "Errore durante l'approvazione della richiesta.",
        variant: "destructive"
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => actionOnRiconoscimento(id, "reject"),
    onSuccess: () => {
      toast({
        title: "Richiesta rifiutata",
        description: "L'esito della richiesta è disponibile all'utente.",
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ["riconoscimenti"] });
    },
    onError: (err: any) => {
      toast({
        title: "Errore",
        description: err?.message || "Errore durante il rifiuto della richiesta.",
        variant: "destructive"
      });
    }
  });

  if (!isAdmin) {
    return (
      <PageContainer className="flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Accesso negato</CardTitle>
            <CardDescription>
              Solo gli amministratori possono gestire le richieste di riconoscimento.
            </CardDescription>
          </CardHeader>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <Card className="w-full max-w-5xl mx-auto shadow-xl border-0">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Riconoscimenti
          </CardTitle>
          <CardDescription>
            Richieste in attesa di verifica. Apri i documenti ufficiali e confronta nome, cognome e ruolo con l'identità verificata tramite CIE prima di approvare.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="py-8 text-center text-sm text-gray-600">
              Caricamento richieste in corso...
            </div>
          )}

          {isError && (
            <div className="py-8 text-center text-sm text-red-600">
              {error instanceof Error ? error.message : "Errore nel caricamento delle richieste."}
            </div>
          )}

          {!isLoading && !isError && data && data.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-600">
              Nessuna richiesta di riconoscimento presente.
            </div>
          )}

          {!isLoading && !isError && data && data.length > 0 && (
            <div className="space-y-4">
              {data.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between border rounded-xl p-4 bg-white/80"
                >
                  <div className="space-y-1 text-sm">
                    <div className="font-semibold text-gray-900">
                      {r.nome} {r.cognome}{" "}
                      <span className="text-xs text-gray-500">
                        ({r.email})
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      Ruolo richiesto:{" "}
                      {r.tipo_ruolo === "P" && "Politico (P)"}
                      {r.tipo_ruolo === "C" && "Candidato (C)"}
                      {r.tipo_ruolo === "CP" && "Candidato Politico (CP)"}
                    </div>
                    <div className={`text-xs font-medium ${r.identity_status === "verified" && r.identity_provider?.toUpperCase() === "CIE" ? "text-emerald-700" : "text-red-700"}`}>
                      {r.identity_status === "verified" && r.identity_provider?.toUpperCase() === "CIE"
                        ? "Identità verificata tramite CIE"
                        : "CIE non verificata: non approvabile"}
                    </div>
                    <div className="text-xs text-gray-600">
                      Ruolo attuale: {r.ruolo_corrente || "Nessuno / Elettore"}
                    </div>
                    {(r.paese_elezione || r.grado_elezione) && (
                      <div className="text-xs text-gray-600">
                        Elezione: {r.grado_elezione || "-"}{" "}
                        {r.comune_elezione || r.regione_elezione || r.paese_elezione
                          ? `(${[r.comune_elezione, r.provincia_elezione, r.regione_elezione, r.paese_elezione].filter(Boolean).join(", ")})`
                          : ""}
                      </div>
                    )}
                    {(r.paese_candidatura || r.grado_candidatura) && (
                      <div className="text-xs text-gray-600">
                        Candidatura: {r.grado_candidatura || "-"}{" "}
                        {r.comune_candidatura || r.regione_candidatura || r.paese_candidatura
                          ? `(${[r.comune_candidatura, r.provincia_candidatura, r.regione_candidatura, r.paese_candidatura].filter(Boolean).join(", ")})`
                          : ""}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs">
                      {r.fonte_elezione_url && (
                        <a href={r.fonte_elezione_url} target="_blank" rel="noopener noreferrer"
                          className="font-medium text-blue-700 underline">
                          Fonte ufficiale elezione
                        </a>
                      )}
                      {r.fonte_candidatura_url && (
                        <a href={r.fonte_candidatura_url} target="_blank" rel="noopener noreferrer"
                          className="font-medium text-blue-700 underline">
                          Fonte ufficiale candidatura
                        </a>
                      )}
                      {((r.tipo_ruolo === "P" || r.tipo_ruolo === "CP") && !r.fonte_elezione_url) ||
                       ((r.tipo_ruolo === "C" || r.tipo_ruolo === "CP") && !r.fonte_candidatura_url)
                        ? <span className="font-semibold text-red-700">Fonte ufficiale mancante: non approvabile</span>
                        : null}
                    </div>
                    <div className="text-xs text-gray-500">
                      Richiesta del: {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-3 md:mt-0 flex gap-2">
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      onClick={() => rejectMutation.mutate(r.id)}
                    >
                      Rifiuta
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      disabled={approveMutation.isPending || rejectMutation.isPending ||
                        r.identity_status !== "verified" || r.identity_provider?.toUpperCase() !== "CIE" ||
                        ((r.tipo_ruolo === "P" || r.tipo_ruolo === "CP") && !r.fonte_elezione_url) ||
                        ((r.tipo_ruolo === "C" || r.tipo_ruolo === "CP") && !r.fonte_candidatura_url)}
                      onClick={() => approveMutation.mutate(r.id)}
                    >
                      Approva
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

