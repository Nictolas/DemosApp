import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

export interface OpinionStatsData {
  stats?: { favorevole: number; contrario: number; indeciso: number; astenuto?: number };
  suppressed?: boolean;
  questionText?: string;
  totaleUtenti?: number;
}

interface OpinionStatsBarProps {
  opinionId: string;
  /** Mostra la barra solo quando l'utente ha votato (selezionato Favorevole/Indeciso/Contrario) */
  show: boolean;
  className?: string;
}

const COLORS = {
  favorevole: "#16a34a",
  indeciso: "#eab308",
  contrario: "#dc2626",
};

export function OpinionStatsBar({ opinionId, show, className = "" }: OpinionStatsBarProps) {
  const { data, isLoading, isError } = useQuery<{ success: boolean; data: OpinionStatsData }>({
    queryKey: ["opinioniStats", opinionId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/opinioni/stats/${encodeURIComponent(opinionId)}`);
      if (!response.ok) throw new Error("Statistiche non disponibili");
      return response.data as { success: boolean; data: OpinionStatsData };
    },
    enabled: !!opinionId && show,
  });

  if (!show) return null;
  if (isLoading) {
    return (
      <div className={`mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Caricamento statistiche...</span>
      </div>
    );
  }
  // The backend deliberately omits stats for small samples (privacy threshold).
  // Never attempt to read a missing stats object: it used to crash the page.
  if (isError || !data?.success || !data.data || data.data.suppressed || !data.data.stats) return null;

  const { stats, totaleUtenti } = data.data;
  const favorevole = stats.favorevole ?? 0;
  const contrario = stats.contrario ?? 0;
  const indeciso = stats.indeciso ?? 0;
  const total = favorevole + contrario + indeciso;
  if (total === 0) return null;

  const pFav = (favorevole / total) * 100;
  const pInd = (indeciso / total) * 100;
  const pCon = (contrario / total) * 100;
  const campione = totaleUtenti ?? total;

  return (
    <div className={`mt-3 space-y-1.5 ${className}`}>
      <p className="text-xs font-medium text-muted-foreground">Campione di {campione} persone.</p>
      <div className="flex h-6 w-full overflow-hidden rounded-full border border-gray-200 bg-gray-100">
        {pFav > 0 && (
          <div
            className="transition-all duration-300"
            style={{ width: `${pFav}%`, backgroundColor: COLORS.favorevole }}
            title={`Favorevole ${pFav.toFixed(0)}%`}
          />
        )}
        {pInd > 0 && (
          <div
            className="transition-all duration-300"
            style={{ width: `${pInd}%`, backgroundColor: COLORS.indeciso }}
            title={`Indeciso ${pInd.toFixed(0)}%`}
          />
        )}
        {pCon > 0 && (
          <div
            className="transition-all duration-300"
            style={{ width: `${pCon}%`, backgroundColor: COLORS.contrario }}
            title={`Contrario ${pCon.toFixed(0)}%`}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        <span style={{ color: COLORS.favorevole }}>Favorevole {pFav.toFixed(0)}%</span>
        <span style={{ color: COLORS.indeciso }}>Indeciso {pInd.toFixed(0)}%</span>
        <span style={{ color: COLORS.contrario }}>Contrario {pCon.toFixed(0)}%</span>
      </div>
    </div>
  );
}
