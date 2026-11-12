import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link as WouterLink } from "wouter";
import { ArrowLeft, ExternalLink, RefreshCw, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { PageContainer } from "@/components/PageContainer";
import { useAuth } from "@/hooks/use-auth";
import { hasAdminCapability } from "@/lib/admin-access";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type VotoFinale = {
  id: number;
  openpolis_id: string;
  camera: "Camera" | "Senato";
  titolo: string;
  url_dettaglio: string;
  esito: "Approvata" | "Respinta";
  data_votazione: string | null;
  data_scraping: string | null;
};

type VotoNominale = { name: string; group: string; vote: string };
type VotiNominaliResponse = {
  success: boolean;
  voteId: string;
  chamber: "Camera" | "Senato";
  date: string;
  source: { type: "official" | "openpolis"; label: string; url: string };
  total: number;
  members: VotoNominale[];
};

type ResponseData = { success: boolean; data: VotoFinale[]; count: number };

const sourcePrefix = "https://parlamento19.openpolis.it/votazioni/";
const maxAgeDays = 120;

function isRecentFinale(v: VotoFinale): boolean {
  if (!v || !["Camera", "Senato"].includes(v.camera)) return false;
  if (!["Approvata", "Respinta"].includes(v.esito)) return false;
  if (!v.url_dettaglio?.startsWith(sourcePrefix)) return false;
  if (!v.data_votazione) return false;
  const d = new Date(v.data_votazione);
  const days = (Date.now() - d.getTime()) / 86400000;
  return Number.isFinite(days) && days >= 0 && days <= maxAgeDays;
}

export default function VotiPoliticiFinali() {
  const [search, setSearch] = useState("");
  const [selectedVote, setSelectedVote] = useState<VotoFinale | null>(null);
  const [handledDeepLink, setHandledDeepLink] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data = [], isLoading, isFetching, error, refetch } = useQuery<VotoFinale[]>({
    queryKey: ["/api/voti-politici/votazioni-finali-decisive", "recenti"],
    queryFn: async () => {
      const result = await apiRequest("GET", "/api/voti-politici/votazioni-finali-decisive?limit=50");
      if (!result.ok) throw new Error("Non è stato possibile caricare le votazioni finali.");
      const json: ResponseData = await result.json();
      if (!json.success || !Array.isArray(json.data)) throw new Error("Risposta non valida.");
      return json.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const sync = useMutation({
    mutationFn: async (): Promise<{ added: number; fetched: number; count: number }> => {
      const response = await apiRequest("POST", "/api/voti-politici/sync-votazioni-finali-decisive");
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Fonte delle votazioni temporaneamente non disponibile.");
      }
      return {
        added: Number(result.added) || 0,
        fetched: Number(result.fetched) || 0,
        count: Number(result.count) || 0
      };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/voti-politici/votazioni-finali-decisive", "recenti"] });
      toast({
        title: result.added > 0
          ? `${result.added} nuove votazioni finali importate`
          : "Sincronizzazione riuscita: nessuna nuova votazione finale",
        description: `${result.fetched} votazioni lette dalla fonte.`
      });
    },
    onError: (error: Error) => toast({
      title: "Impossibile sincronizzare Openpolis",
      description: error.message,
      variant: "destructive"
    })
  });

  const nominal = useQuery<VotiNominaliResponse>({
    queryKey: ["/api/voti-politici/votazioni-finali-decisive", selectedVote?.openpolis_id, "voti-nominali"],
    enabled: !!selectedVote,
    queryFn: async () => {
      const response = await apiRequest("GET",
        "/api/voti-politici/votazioni-finali-decisive/" +
        encodeURIComponent(selectedVote!.openpolis_id) + "/voti-nominali");
      if (!response.ok) throw new Error("Voti nominali non verificabili per questa votazione.");
      const result: VotiNominaliResponse = await response.json();
      if (!result.success || !Array.isArray(result.members) || !result.source) {
        throw new Error("Risposta dei voti individuali non valida.");
      }
      return result;
    },
    staleTime: 12 * 60 * 60 * 1000,
    retry: false
  });
  // Old push messages still resolve in the archive after the single latest
  // notification has been replaced. Only existing recent FINAL votes can open.
  useEffect(() => {
    if (handledDeepLink || data.length === 0 || typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("final_vote");
    if (!id || !/^(?:vs19_\d{1,5}_\d{1,5}|19-\d{1,5}-\d{1,5})$/.test(id)) {
      setHandledDeepLink(true);
      return;
    }
    const match = data.find(v => v.openpolis_id === id && isRecentFinale(v));
    if (match) setSelectedVote(match);
    setHandledDeepLink(true);
  }, [data, handledDeepLink]);

  const visibleMembers = useMemo(() => {
    const q = memberSearch.trim().toLocaleLowerCase("it");
    return (nominal.data?.members || []).filter(m =>
      !q || [m.name, m.group, m.vote].some(x => x.toLocaleLowerCase("it").includes(q))
    );
  }, [memberSearch, nominal.data?.members]);
  const trustedSource = nominal.data?.source?.url || "";
  const trustedSourceLink = trustedSource.startsWith("https://documenti.camera.it/") ||
    trustedSource.startsWith("https://parlamento19.openpolis.it/votazioni/")
      ? trustedSource : null;

  const visible = useMemo(() => data.filter(isRecentFinale).filter(v => {
    const q = search.toLocaleLowerCase("it").trim();
    return !q || [v.titolo, v.camera, v.esito].some(s => String(s).toLocaleLowerCase("it").includes(q));
  }).sort((a,b) => new Date(b.data_votazione || 0).getTime() - new Date(a.data_votazione || 0).getTime()), [data, search]);

  return (
    <PageContainer className="overflow-y-auto overscroll-contain bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="w-full flex-none px-4 py-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <WouterLink href="/preferiti"><Button size="icon" variant="ghost" aria-label="Torna al menu"><ArrowLeft size={16} /></Button></WouterLink>
            <div>
              <h1 className="text-xl font-semibold">Votazioni finali del Parlamento</h1>
              <p className="text-sm text-muted-foreground">Solo voti finali di Camera e Senato — più recenti prima</p>
            </div>
          </div>
          <div className="flex gap-2">
            {hasAdminCapability(user) && <Button variant="outline" size="sm" disabled={sync.isPending} onClick={() => sync.mutate()}>{sync.isPending ? "Sincronizzazione…" : "Sincronizza voti finali"}</Button>}
            <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}><RefreshCw className="mr-1 h-4 w-4" /> Aggiorna</Button>
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm space-y-3">
          <p className="text-sm text-muted-foreground">Vengono mostrate soltanto le votazioni identificate come <strong>voto finale</strong> da Openpolis negli ultimi {maxAgeDays} giorni. Non compaiono articoli, emendamenti, ordini del giorno né vecchie votazioni.</p>
          <p className="text-xs text-muted-foreground">Il voto finale in una Camera non significa necessariamente che una legge sia già definitivamente approvata da entrambe le Camere. I voti individuali vengono mostrati soltanto quando la fonte della singola votazione è verificabile; le spiegazioni AI richiedono inoltre il testo ufficiale dell'atto.</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input aria-label="Cerca votazioni finali" placeholder="Cerca votazione, Camera, Senato o esito" className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isLoading ? <p role="status">Caricamento votazioni finali recenti…</p> : error ? (
            <p role="alert" className="text-red-700">Impossibile recuperare le votazioni finali. Riprova con Aggiorna.</p>
          ) : visible.length === 0 ? (
            <p role="status">Non ci sono votazioni finali recenti verificate da mostrare. Non vengono riproposte le vecchie votazioni.</p>
          ) : (
            <div className="space-y-3" role="list" aria-label="Elenco votazioni finali recenti">
              {visible.map(v => (
                <article key={v.openpolis_id} role="listitem" className="rounded-lg border bg-white p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {new Date(v.data_votazione!).toLocaleDateString("it-IT")} · {v.camera} · {v.esito}
                  </p>
                  <h2 className="font-semibold break-words">{v.titolo}</h2>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Button variant="outline" size="sm" onClick={() => {
                      setSelectedVote(v);
                      setMemberSearch("");
                    }}>Vedi voti</Button>
                    <a className="text-blue-700 underline text-sm inline-flex items-center gap-1"
                      href={v.url_dettaglio} target="_blank" rel="noopener noreferrer">
                      Openpolis <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!isLoading && !error && <p className="text-xs text-muted-foreground">{visible.length} votazioni finali recenti disponibili.</p>}
        </div>
        <Dialog open={!!selectedVote} onOpenChange={open => {
          if (!open) { setSelectedVote(null); setMemberSearch(""); }
        }}>
          <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedVote?.titolo}</DialogTitle>
              <DialogDescription>
                {selectedVote?.camera} — votazione finale del {selectedVote?.data_votazione
                  ? new Date(selectedVote.data_votazione).toLocaleDateString("it-IT")
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {nominal.isLoading ? <p role="status">Verifica dei voti individuali dalla fonte…</p> :
                nominal.error || !nominal.data ? (
                  <p role="alert" className="text-sm text-muted-foreground">
                    I voti nominali non sono verificabili al momento. Nessun voto viene attribuito senza una fonte.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {nominal.data.total} nominativi pubblicati.
                      Fonte: <strong>{nominal.data.source.label}</strong>
                      {nominal.data.source.type === "openpolis"
                        ? " (fonte di consultazione, non il sito istituzionale del Senato)"
                        : " (registro istituzionale della Camera)"}
                      . L'assenza o la missione non sono voti contrari.
                    </p>
                    {trustedSourceLink && <a href={trustedSourceLink}
                      className="text-blue-700 underline inline-flex gap-1 items-center text-sm"
                      target="_blank" rel="noopener noreferrer">Apri la fonte dei voti <ExternalLink className="h-4 w-4" /></a>}
                    <Input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                      aria-label="Cerca parlamentare o voto"
                      placeholder="Cerca parlamentare, gruppo o voto…" />
                    <div className="max-h-[55dvh] overflow-auto overscroll-contain rounded border"
                      role="region" aria-label="Voti nominali dei parlamentari" tabIndex={0}>
                      <table className="min-w-[500px] w-full text-sm text-left">
                        <thead className="sticky top-0 bg-white">
                          <tr><th className="p-2">Parlamentare</th><th className="p-2">Gruppo</th><th className="p-2">Voto / stato</th></tr>
                        </thead>
                        <tbody>{visibleMembers.map(m => <tr key={m.name} className="border-t">
                          <td className="p-2">{m.name}</td><td className="p-2">{m.group}</td>
                          <td className="p-2">{m.vote}</td>
                        </tr>)}</tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground">{visibleMembers.length} nominativi visualizzati.
                      I valori sono quelli riportati dalla fonte, senza inferenze dell'AI.</p>
                  </>
                )}
              <a href={selectedVote?.url_dettaglio || "https://parlamento19.openpolis.it/votazioni"}
                className="text-blue-700 underline inline-flex items-center gap-1 text-sm"
                target="_blank" rel="noopener noreferrer">
                Scheda della votazione su Openpolis <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </PageContainer>
  );
}
