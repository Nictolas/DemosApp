import { useMemo, useState } from "react";
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
            {hasAdminCapability(user) && <Button variant="outline" size="sm" disabled={sync.isPending} onClick={() => sync.mutate()}>{sync.isPending ? "Sincronizzazione…" : "Sincronizza voti finali"}</Button>}
            <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}><RefreshCw className="mr-1 h-4 w-4" /> Aggiorna</Button>
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm space-y-3">
          <p className="text-sm text-muted-foreground">Vengono mostrate soltanto le votazioni identificate come <strong>voto finale</strong> da Openpolis negli ultimi {maxAgeDays} giorni. Non compaiono articoli, emendamenti, ordini del giorno né vecchie votazioni.</p>
          <p className="text-xs text-muted-foreground">Il voto finale in una Camera non significa necessariamente che una legge sia già definitivamente approvata da entrambe le Camere. I voti individuali e le spiegazioni AI saranno visibili soltanto dopo verifica delle fonti.</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input aria-label="Cerca votazioni finali" placeholder="Cerca votazione, Camera, Senato o esito" className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isLoading ? <p role="status">Caricamento votazioni finali recenti…</p> : error ? (
            <p role="alert" className="text-red-700">Impossibile recuperare le votazioni finali. Riprova con Aggiorna.</p>
          ) : visible.length === 0 ? (
            <p role="status">Non ci sono votazioni finali recenti verificate da mostrare. Non vengono riproposte le vecchie votazioni.</p>
          ) : (
            <div className="max-h-[68dvh] overflow-auto overscroll-contain" tabIndex={0} role="region" aria-label="Elenco votazioni finali recenti">
              <table className="min-w-[640px] w-full text-left text-sm">
                <thead className="sticky top-0 bg-white shadow-sm">
                  <tr><th className="p-3">Data</th><th className="p-3">Camera</th><th className="p-3">Votazione finale</th><th className="p-3">Esito</th><th className="p-3">Fonte</th></tr>
                </thead>
                <tbody>
                {visible.map(v => <tr key={v.openpolis_id} className="border-t align-top">
                  <td className="p-3 whitespace-nowrap">{new Date(v.data_votazione!).toLocaleDateString("it-IT")}</td>
                  <td className="p-3">{v.camera}</td>
                  <td className="p-3">{v.titolo}</td>
                  <td className="p-3">{v.esito}</td>
                  <td className="p-3"><a className="text-blue-700 underline inline-flex items-center gap-1" href={v.url_dettaglio} target="_blank" rel="noopener noreferrer">Openpolis <ExternalLink className="h-3 w-3" /></a></td>
                </tr>)}
                </tbody>
              </table>
            </div>
          )}
          {!isLoading && !error && <p className="text-xs text-muted-foreground">{visible.length} votazioni finali recenti disponibili.</p>}
        </div>
      </main>
    </PageContainer>
  );
}
