import React, { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  FileSignature,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Search,
  ArrowUpDown,
} from "lucide-react";

interface ECIItem {
  id: string;
  title: string;
  firme: number;
  signature_count?: number;
  slug?: string;
  end_date?: string | null;
  obiettivi?: string | null;
  url?: string | null;
}

interface ECIDataResponse {
  success: boolean;
  source?: string;
  initiatives?: ECIItem[];
  ongoing?: ECIItem[];
  successi?: ECIItem[];
}

type SortOption = "firme" | "scadenza" | null;

export default function ECI() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("firme");
  const [viewItem, setViewItem] = useState<ECIItem | null>(null);

  const {
    data: eciData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ECIDataResponse>({
    queryKey: ["eci", "initiatives"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/eci");
      if (!response?.ok || !response?.data) {
        throw new Error(
          response?.data?.error ||
            response?.data?.message ||
            "Errore nel caricamento delle ECI"
        );
      }
      const result = response.data;
      if (result && !result.success && result.success !== undefined) {
        throw new Error(
          result.error || result.message || "Errore nel caricamento delle ECI"
        );
      }
      return {
        ...result,
        success: true,
        initiatives: result.initiatives || [],
        ongoing: result.ongoing || [],
        successi: result.successi || [],
      };
    },
    enabled: !!user,
    retry: 1,
  });

  const toItem = (item: any): ECIItem => ({
    id: item.id,
    title: item.title || "Senza titolo",
    firme: item.firme ?? item.signature_count ?? 0,
    slug: item.slug,
    end_date: item.end_date ?? null,
    obiettivi: item.obiettivi ?? null,
    url: item.url ?? null,
  });

  const formatScadenza = (d: string | null | undefined): string => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return day && m && y ? `${day}/${m}/${y}` : d;
  };

  const ongoing: ECIItem[] = (eciData?.ongoing || []).map(toItem).sort((a, b) => b.firme - a.firme);
  const hasSections = (eciData?.ongoing ?? eciData?.successi) !== undefined;
  const baseList: ECIItem[] = hasSections
    ? ongoing
    : (eciData?.initiatives || []).map(toItem).sort((a, b) => b.firme - a.firme);

  const displayList = useMemo(() => {
    let list = [...baseList];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.obiettivi?.toLowerCase().includes(q)
      );
    }
    if (sortBy === "firme") {
      list.sort((a, b) => b.firme - a.firme);
    } else if (sortBy === "scadenza") {
      list.sort((a, b) => {
        const da = a.end_date || "";
        const db = b.end_date || "";
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da.localeCompare(db);
      });
    }
    return list;
  }, [baseList, searchQuery, sortBy]);

  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className="overflow-hidden">
    <div className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain eci-page container mx-auto px-4 py-8" role="region" aria-label="Elenco ECI" tabIndex={0}>
      <Card className="w-full rounded-2xl shadow-lg bg-white">
        <CardContent className="p-6">
          {/* Top bar: refresh */}
          <div className="flex items-center justify-end mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Aggiorna
            </Button>
          </div>

          {/* Header come Iniziative Popolari */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <FileSignature className="h-8 w-8 text-teal-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-900">ECI</h1>
            </div>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Le Iniziative dei Cittadini Europei (ECI) sono uno strumento per permettere ai cittadini europei di proporre nuove leggi. Devono essere raccolte un milione di firme, in un anno, in almeno 7 paesi dell'Unione Europea.
            </p>
            <p className="text-gray-500 text-sm max-w-2xl mx-auto mt-2">
              I numeri delle firme vengono aggiornati ogni 2 ore. Per il dato in tempo reale usa il pulsante &quot;Vai al sito UE&quot; sotto ogni iniziativa.
            </p>
          </div>

          {isError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error instanceof Error ? error.message : "Errore nel caricamento delle ECI."}
              </AlertDescription>
            </Alert>
          )}

          {!isError && (
            <>
              {/* Search + Sort come Iniziative Popolari */}
              <div className="space-y-4 mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Cerca per titolo o obiettivi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={sortBy === "firme" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortBy(sortBy === "firme" ? null : "firme")}
                    className="flex items-center gap-2"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    Ordina per Firme
                  </Button>
                  <Button
                    variant={sortBy === "scadenza" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortBy(sortBy === "scadenza" ? null : "scadenza")}
                    className="flex items-center gap-2"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    Ordina per Scadenza
                  </Button>
                  {sortBy && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSortBy(null)}
                      className="text-gray-500"
                    >
                      Rimuovi filtro
                    </Button>
                  )}
                </div>
              </div>

              {/* Lista: card come Iniziative Popolari */}
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                </div>
              ) : displayList.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nessuna iniziativa in corso.
                </div>
              ) : (
                <div className="eci-grid">
                  {displayList.map((item) => (
                    <div
                      key={item.id}
                      className="eci-card border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-white"
                      onClick={() => setViewItem(item)}
                    >
                      <div className="flex flex-col items-center text-center h-full">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {item.title}
                        </h3>
                        <div className="flex flex-col items-center gap-2 text-sm text-gray-500 mt-3">
                          <span>
                            Firme raccolte:{" "}
                            <strong className="text-teal-600">
                              {item.firme.toLocaleString("it-IT")}
                            </strong>
                          </span>
                          {item.end_date && (
                            <span>
                              Scadenza:{" "}
                              <strong>{formatScadenza(item.end_date)}</strong>
                            </span>
                          )}
                        </div>
                        {/* Progresso verso 1M (ECI quorum) */}
                        <div className="mt-4 w-full">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>Progresso verso 1.000.000 firme</span>
                            <span className="font-semibold">
                              {Math.min(
                                (item.firme / 1_000_000) * 100,
                                100
                              ).toFixed(1)}
                              %
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500 bg-teal-500"
                              style={{
                                width: `${Math.min(
                                  (item.firme / 1_000_000) * 100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                        {item.url && (
                          <div className="mt-4 mt-auto pt-2">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-teal-600 hover:bg-teal-700 text-white"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Vai al sito UE
                              </Button>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog dettaglio: stesso stile ViewDialog Iniziative Popolari (full screen) */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="w-screen h-screen max-w-none max-h-none left-0 top-0 translate-x-0 translate-y-0 rounded-none bg-white overflow-y-auto p-6">
          <DialogHeader className="bg-white">
            <DialogTitle className="text-2xl font-bold text-gray-900">
              {viewItem?.title}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Dettagli dell'iniziativa cittadini europei
            </DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4 bg-white overflow-y-auto">
              {viewItem.obiettivi && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Obiettivi</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {viewItem.obiettivi}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Firme raccolte</h4>
                  <p className="text-gray-700 font-semibold text-teal-600">
                    {viewItem.firme.toLocaleString("it-IT")}
                  </p>
                </div>
                {viewItem.end_date && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Scadenza</h4>
                    <p className="text-gray-700">
                      {formatScadenza(viewItem.end_date)}
                    </p>
                  </div>
                )}
              </div>
              {viewItem.url && (
                <div>
                  <a
                    href={viewItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Apri sul portale UE
                    </Button>
                  </a>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between mt-4 bg-white">
            <div />
            <Button variant="outline" onClick={() => setViewItem(null)}>
              Chiudi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PageContainer>
  );
}
