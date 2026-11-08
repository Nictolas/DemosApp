import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type CameraSenato = "Camera" | "Senato";
type CurrentNominalVote = {
  institution: CameraSenato;
  representative_key: string;
  ballot_id: string;
  vote_date: string;
  vote: string;
  ballot_title: string;
  ballot_outcome: string | null;
  source_type: "camera_ufficiale" | "senato_openpolis";
  source_url: string;
};

type CurrentVoteResponse = {
  success: boolean;
  data: CurrentNominalVote | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function LatestItalianNominalVote({
  representativeId, chamber
}: { representativeId?: string | null; chamber: CameraSenato }) {
  const [expanded, setExpanded] = useState(false);
  const validId = typeof representativeId === "string" && uuidPattern.test(representativeId);
  const { data, isLoading, isError } = useQuery<CurrentNominalVote | null>({
    queryKey: ["prod041-current-nominal", chamber, representativeId],
    enabled: expanded && validId,
    queryFn: async () => {
      const response = await apiRequest("GET",
        "/api/voti-politici/rappresentanti/" + encodeURIComponent(representativeId!) +
        "/ultimo-voto?camera=" + encodeURIComponent(chamber));
      if (!response.ok) throw new Error("Voto verificato non disponibile");
      const result: CurrentVoteResponse = await response.json();
      if (!result.success) throw new Error("Fonte non verificata");
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false
  });

  // No lookup by a name, a nonexistent representative, or an EU category.
  // Zero extra reads until the user explicitly expands this section.
  if (!validId) return null;
  const date = data?.vote_date ? String(data.vote_date).slice(0, 10) : null;
  const verifiedSource = data?.source_type === "camera_ufficiale"
    ? "Camera dei deputati (istituzionale)"
    : data?.source_type === "senato_openpolis"
      ? "Openpolis (fonte di consultazione, non istituzionale)"
      : null;
  return (
    <div className="pl-11 text-xs">
      <button
        type="button"
        onClick={() => setExpanded(open => !open)}
        aria-expanded={expanded}
        className="font-medium text-blue-700 underline hover:text-blue-900"
      >
        {expanded ? "Nascondi ultimo voto" : "Mostra ultimo voto verificato"}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1 rounded border p-2 text-gray-700" role="region" aria-label="Ultimo voto nominale verificato">
          {isLoading ? (
            <p>Verifica del voto in corso…</p>
          ) : isError ? (
            <p>Impossibile verificare l’ultimo voto al momento.</p>
          ) : !data ? (
            <p>Nessun voto nominale attribuibile con certezza.</p>
          ) : (
            <>
              <p className="font-semibold">{data.ballot_title}</p>
              <p>Data: {date || "Non disponibile"}</p>
              <p>Voto espresso: {data.vote}</p>
              <p>Esito: {data.ballot_outcome || "Non disponibile dalla fonte"}</p>
              {verifiedSource && <p>Fonte: {verifiedSource}</p>}
              {verifiedSource && data.source_url?.startsWith("https://") && (
                <a href={data.source_url} target="_blank" rel="noopener noreferrer"
                  className="text-blue-700 underline">
                  Consulta la fonte
                </a>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
