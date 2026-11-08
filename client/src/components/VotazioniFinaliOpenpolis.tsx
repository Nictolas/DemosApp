import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, RefreshCw } from "lucide-react";

type FinalVoteSource = {
  openpolis_id: string;
  camera: "Camera" | "Senato";
  titolo: string;
  url_dettaglio: string;
  esito: string | null;
  data_votazione: string | null;
};

function sourceLink(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "parlamento19.openpolis.it" ||
        !/^\/votazioni\/[a-zA-Z0-9_-]+\/?$/.test(parsed.pathname)) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function dateLabel(value: string | null): string {
  const date = value?.slice(0, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Data da verificare";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function VoteRow({ item }: { item: FinalVoteSource }) {
  const href = sourceLink(item.url_dettaglio);
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={item.camera === "Senato" ? "border-purple-200 text-purple-800" : "border-blue-200 text-blue-800"}>
          {item.camera}
        </Badge>
        <span className="text-xs text-slate-600">{dateLabel(item.data_votazione)}</span>
        <span className="text-xs font-medium text-slate-700">{item.esito || "Esito non disponibile"}</span>
      </div>
      <p className="text-sm font-medium text-slate-900">{item.titolo}</p>
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-700 underline underline-offset-2">
          Scheda originale Openpolis <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
    </li>
  );
}

export default function VotazioniFinaliOpenpolis() {
  const { data = [], isLoading, isError, refetch, isFetching } = useQuery<FinalVoteSource[]>({
    queryKey: ["/api/voti-politici/votazioni-finali-decisive", 30],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/voti-politici/votazioni-finali-decisive?limit=30");
      if (!response.ok) throw new Error("Fonte votazioni finali non disponibile");
      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) throw new Error("Risposta non valida");
      return result.data.filter((vote: FinalVoteSource) =>
        vote && (vote.camera === "Camera" || vote.camera === "Senato") &&
        typeof vote.titolo === "string" && vote.titolo.trim().length > 0 &&
        typeof vote.url_dettaglio === "string" && Boolean(sourceLink(vote.url_dettaglio))
      );
    },
    staleTime: 60000,
    retry: 1
  });

  const camera = data.filter(v => v.camera === "Camera");
  const senato = data.filter(v => v.camera === "Senato");

  return (
    <section aria-label="Votazioni finali registrate da Openpolis" className="mb-6">
      <Card className="border-blue-200">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Ultime votazioni finali</CardTitle>
              <CardDescription className="mt-1">
                Votazioni classificate come finali da Openpolis, distinte per Camera e Senato.
                L'approvazione di una votazione non implica che la legge sia definitivamente approvata o in vigore.
              </CardDescription>
            </div>
            <button type="button" onClick={() => void refetch()} disabled={isFetching}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
              Aggiorna
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-slate-600">Caricamento delle votazioni finali…</p> :
            isError ? <p role="alert" className="text-sm text-red-700">Non riesco a leggere i dati Openpolis. Riprova con Aggiorna.</p> :
            data.length === 0 ? <p className="text-sm text-slate-600">Nessuna votazione finale presente nel database.</p> : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {([{ name: "Camera dei deputati", items: camera },
                   { name: "Senato della Repubblica", items: senato }] as const).map(group => (
                  <div key={group.name}>
                    <h3 className="mb-3 font-semibold">{group.name} ({group.items.length})</h3>
                    <ul className="space-y-3">
                      {group.items.length ? group.items.map(item =>
                        <VoteRow key={item.openpolis_id} item={item} />
                      ) : <li className="text-sm text-slate-600">Nessun voto finale disponibile.</li>}
                    </ul>
                  </div>
                ))}
              </div>
            )}
        </CardContent>
      </Card>
    </section>
  );
}
