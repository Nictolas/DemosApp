import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";

type VotoNominale = {
  nome: string;
  voto: string;
  gruppo: string;
  url_profilo: string | null;
};

type Dettaglio = {
  openpolis_id: string;
  camera: "Camera" | "Senato";
  titolo: string;
  voto_segreto: boolean;
  voti_nominali: VotoNominale[];
  voti_disponibili: number;
  riepilogo: { presenti: number | null; votanti: number | null; maggioranza: number | null };
  fonte_url: string;
  cache_stale: boolean;
  aggiornato_il: string;
};

export function VotoFinaleNominale({ id, sourceUrl }: { id: string; sourceUrl: string }) {
  const [term, setTerm] = useState("");
  const [vote, setVote] = useState("Tutti");
  const { data, isLoading, error, refetch, isFetching } = useQuery<Dettaglio>({
    queryKey: ["/api/voti-politici/votazioni-finali-decisive", id, "dettaglio"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/voti-politici/votazioni-finali-decisive/" + encodeURIComponent(id) + "/dettaglio");
      if (!response.ok) throw new Error("Dati nominali non verificabili.");
      const json = await response.json();
      if (!json.success || !Array.isArray(json.data?.voti_nominali)) throw new Error("Risposta della fonte non valida.");
      return json.data;
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const statuses = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const row of data.voti_nominali) counts.set(row.voto, (counts.get(row.voto) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const matching = useMemo(() => {
    if (!data) return [];
    const q = term.toLocaleLowerCase("it").trim();
    return data.voti_nominali.filter(row =>
      (vote === "Tutti" || row.voto === vote) &&
      (!q || [row.nome, row.gruppo, row.voto].some(text => text.toLocaleLowerCase("it").includes(q)))
    );
  }, [data, term, vote]);

  const verifiedUrl = data?.fonte_url?.startsWith("https://parlamento19.openpolis.it/votazioni/")
    ? data.fonte_url : sourceUrl;

  return (
    <section className="rounded-lg border bg-slate-50 p-3 sm:p-4 space-y-3" aria-label="Dettaglio nominale della votazione">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold">Come hanno votato i parlamentari</h3>
        <a href={verifiedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-700 underline">
          Verifica su Openpolis <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {isLoading ? <p role="status" className="text-sm">Caricamento dei voti nominali dalla fonte…</p> : error ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-red-700">I voti nominali non sono disponibili o non sono stati verificati. Nessun voto viene attribuito per supposizione.</p>
          <button className="text-sm text-blue-700 underline" type="button" onClick={() => refetch()} disabled={isFetching}>Riprova</button>
        </div>
      ) : data ? (
        <>
          {data.voto_segreto && (
            <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
              Scrutinio segreto: la fonte non rivela se il singolo parlamentare ha votato a favore o contro.
              Può indicare soltanto la partecipazione e le assenze.
            </p>
          )}
          {data.cache_stale && <p className="text-sm text-amber-800">Dati verificati in precedenza: aggiornamento della fonte non riuscito. Le informazioni potrebbero non essere recenti.</p>}
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {([["Presenti", data.riepilogo?.presenti], ["Votanti", data.riepilogo?.votanti], ["Maggioranza", data.riepilogo?.maggioranza]] as const).map(([label, n]) => (
              <div className="rounded border bg-white p-2" key={label}><strong className="block text-base">{n ?? "—"}</strong>{label}</div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {statuses.map(([status, count]) => <span className="rounded-full border bg-white px-2 py-1" key={status}>{status}: {count}</span>)}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input className="pl-9 bg-white" aria-label="Cerca un parlamentare" placeholder="Cerca nome o gruppo parlamentare" value={term} onChange={e => setTerm(e.target.value)} />
            </div>
            <select aria-label="Filtra per voto" className="rounded-md border bg-white px-3 py-2 text-sm" value={vote} onChange={e => setVote(e.target.value)}>
              <option value="Tutti">Tutti i voti</option>
              {statuses.map(([status]) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">{matching.length} di {data.voti_nominali.length} parlamentari presenti nella fonte nominale.</p>
          <ul className="grid gap-2 md:grid-cols-2" aria-label="Voti individuali">
            {matching.map(row => (
              <li className="flex items-start justify-between gap-3 rounded border bg-white p-2 text-sm" key={row.nome}>
                <div className="min-w-0">
                  <span className="block font-medium break-words">{row.nome}</span>
                  <span className="text-xs text-muted-foreground break-words">{row.gruppo || "Gruppo non indicato"}</span>
                </div>
                <span className="shrink-0 text-right font-medium">{row.voto}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Fonte: Openpolis, votazione identificata {id}. Le posizioni dei gruppi non vengono attribuite automaticamente ai singoli.</p>
        </>
      ) : null}
    </section>
  );
}
