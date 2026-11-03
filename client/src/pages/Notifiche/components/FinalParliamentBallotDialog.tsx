import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Notifica } from "../types";

type Member = { name: string; group: string; vote: string };
type VerifiedBallot = {
  success: boolean;
  voteId: string;
  chamber: "Camera" | "Senato";
  date: string;
  source: { type: "official" | "openpolis"; label: string; url: string };
  members: Member[];
  total: number;
};
type Props = { open: boolean; onOpenChange: (open: boolean) => void; notifica: Notifica };

function normalized(name: string): string {
  return (name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ").trim().replace(/\s+/g, " ").toLowerCase();
}

export function FinalParliamentBallotDialog({ open, onOpenChange, notifica }: Props) {
  const [search, setSearch] = useState("");
  const id = notifica.openpolis_id || "";
  const query = useQuery<VerifiedBallot>({
    queryKey: ["/api/voti-politici/votazioni-finali-decisive", id, "voti-nominali"],
    enabled: open && !!id,
    queryFn: async () => {
      const response = await apiRequest("GET",
        "/api/voti-politici/votazioni-finali-decisive/" + encodeURIComponent(id) + "/voti-nominali");
      if (!response.ok) throw new Error("Fonte non verificabile");
      const data: VerifiedBallot = await response.json();
      if (!data.success || data.voteId !== id || !Array.isArray(data.members) || !data.source) {
        throw new Error("Votazione non verificabile");
      }
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false
  });
  const representative = normalized(
    (notifica.politico_nome && notifica.politico_cognome
      ? notifica.politico_nome + " " + notifica.politico_cognome
      : notifica.politico) || ""
  );
  const reverseName = normalized(
    notifica.politico_nome && notifica.politico_cognome
      ? notifica.politico_cognome + " " + notifica.politico_nome : ""
  );
  const ownMatches = useMemo(() => (query.data?.members || []).filter(m =>
    normalized(m.name) === representative || (!!reverseName && normalized(m.name) === reverseName)
  ), [query.data?.members, representative, reverseName]);
  // If the source changes or matching is ambiguous, never assert a personal vote.
  const own = ownMatches.length === 1 && ownMatches[0].vote === notifica.voto ? ownMatches[0] : null;
  const visible = useMemo(() => {
    const q = normalized(search);
    return (query.data?.members || []).filter(m =>
      !q || [m.name, m.group, m.vote].some(v => normalized(v).includes(q))
    );
  }, [query.data?.members, search]);
  const sourceUrl = query.data?.source?.url || "";
  const safeSource = sourceUrl.startsWith("https://documenti.camera.it/") ||
    sourceUrl.startsWith("https://parlamento19.openpolis.it/votazioni/") ? sourceUrl : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,720px)] max-h-[90dvh] overflow-y-auto overscroll-contain p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="break-words">Votazione finale del tuo rappresentante</DialogTitle>
          <DialogDescription>
            {query.data?.chamber || notifica.camera || "Parlamento"} · {notifica.data
              ? new Date(notifica.data).toLocaleDateString("it-IT") : "Data non disponibile"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <section className="space-y-2">
            <h3 className="font-semibold">Che cosa è stato votato</h3>
            <p className="break-words">{notifica.votazione_titolo || "Titolo non disponibile"}</p>
            {notifica.votazione_esito && <p>Esito della votazione: <strong>{notifica.votazione_esito}</strong></p>}
            <p className="text-xs text-muted-foreground">
              Il voto finale in una Camera non significa automaticamente che la legge sia in vigore.
              La spiegazione del testo ufficiale sarà aggiunta separatamente, quando verificata.
            </p>
          </section>
          <section className="rounded-lg border bg-slate-50 p-3 space-y-2">
            <h3 className="font-semibold">Il tuo rappresentante</h3>
            {query.isLoading ? <p role="status">Verifica dalla fonte in corso…</p> :
              query.isError || !query.data ? (
                <p role="alert">Fonte temporaneamente non verificabile: nessun voto individuale viene attribuito.</p>
              ) : own ? (
                <>
                  <p className="font-medium">{own.name}</p>
                  <p>Voto / stato: <strong>{own.vote}</strong></p>
                  <p className="text-xs text-muted-foreground">Gruppo: {own.group}</p>
                </>
              ) : (
                <p role="alert">Non è stato possibile associare in modo univoco questo rappresentante alla votazione. Nessun voto viene attribuito.</p>
              )}
          </section>
          {!!query.data && (
            <>
              <section className="space-y-1">
                <p>Fonte dei voti: <strong>{query.data.source.label}</strong>
                  {query.data.source.type === "openpolis" ? " (fonte di consultazione, non sito istituzionale del Senato)" : " (Camera dei deputati)"}.</p>
                <p className="text-xs text-muted-foreground">Assenze, missioni e presenze senza voto non sono voti contrari.</p>
                {safeSource && <a href={safeSource} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-700 underline">
                  Consulta la fonte <ExternalLink size={14} />
                </a>}
              </section>
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer font-semibold">Voti nominali degli altri parlamentari ({query.data.total})</summary>
                <div className="mt-3 space-y-2">
                  <div className="relative">
                    <Search size={16} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)}
                      className="pl-8" aria-label="Cerca parlamentare"
                      placeholder="Cerca parlamentare, gruppo o voto" />
                  </div>
                  <div className="max-h-[45dvh] overflow-y-auto overscroll-contain" role="region"
                    tabIndex={0} aria-label="Elenco dei voti nominali">
                    {visible.map(m => (
                      <div className="border-b py-2" key={m.name}>
                        <span className="font-medium">{m.name}</span>
                        <span className="block text-muted-foreground">{m.group} · {m.vote}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
