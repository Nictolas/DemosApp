import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link as WouterLink } from "wouter";
import { ArrowLeft, ChevronDown, ExternalLink, RefreshCw, Search } from "lucide-react";
import { VotoFinaleNominale } from "@/components/VotoFinaleNominale";
import { apiRequest } from "@/lib/queryClient";
import { PageContainer } from "@/components/PageContainer";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
            {user?.ruolo === "AD" && <Button variant="outline" size="sm" disabled={sync.isPending} onClick={() => sync.mutate()}>{sync.isPending ? "Sincronizzazione…" : "Sincronizza voti finali"}</Button>}
            <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}><RefreshCw className="mr-1 h-4 w-4" /> Aggiorna</Button>
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm space-y-3">
          <p className="text-sm text-muted-foreground">Vengono mostrate soltanto le votazioni identificate come <strong>voto finale</strong> da Openpolis negli ultimi {maxAgeDays} giorni. Non compaiono articoli, emendamenti, ordini del giorno né vecchie votazioni.</p>
          <p className="text-xs text-muted-foreground">Il voto finale in una Camera non significa necessariamente che una legge sia già definitivamente approvata da entrambe le Camere. I voti individuali sono disponibili aprendo ogni votazione soltanto quando la fonte è verificabile. Le spiegazioni AI saranno aggiunte in una fase successiva.</p>
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
                <article key={v.openpolis_id} role="listitem" className="rounded-lg border border-slate-200 bg-white">
                  <div className="flex items-start justify-between gap-2 p-3">
                    <button type="button" className="min-w-0 flex-1 text-left space-y-1"
                      aria-expanded={expandedId === v.openpolis_id}
                      aria-controls={"dettaglio-" + v.openpolis_id}
                      onClick={() => setExpandedId(previous => previous === v.openpolis_id ? null : v.openpolis_id)}>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(v.data_votazione!).toLocaleDateString("it-IT")} · {v.camera} · {v.esito}
                      </span>
                      <span className="block font-semibold break-words">{v.titolo}</span>
                      <span className="inline-flex items-center gap-1 text-sm text-blue-700">
                        {expandedId === v.openpolis_id ? "Chiudi dettaglio" : "Mostra voti dei parlamentari"}
                        <ChevronDown className={expandedId === v.openpolis_id ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
                      </span>
                    </button>
                    <a href={v.url_dettaglio} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 text-sm text-blue-700 underline">
                      Openpolis <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {expandedId === v.openpolis_id && (
                    <div className="p-3 pt-0" id={"dettaglio-" + v.openpolis_id}>
                      <VotoFinaleNominale id={v.openpolis_id} sourceUrl={v.url_dettaglio} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
          {!isLoading && !error && <p className="text-xs text-muted-foreground">{visible.length} votazioni finali recenti disponibili.</p>}
        </div>
      </main>
    </PageContainer>
  );
}
