import React, { useCallback, useEffect, useState } from "react";
import { BarChart3, ChevronDown, ChevronUp, ExternalLink, History, Loader2, MapPin, MinusCircle, Vote, XCircle, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Choice = "YES" | "NO" | "ABSTAIN";

type Forecast = {
  suppressed: boolean;
  minimumResponses: number;
  totalResponses: number;
  intendingVoters?: number;
  turnoutPercent?: number | null;
  yesPercent?: number | null;
  noPercent?: number | null;
  abstainPercent?: number | null;
  quorum?: {
    kind: string;
    required: boolean;
    thresholdPercent: number | null;
    forecastReached: boolean | null;
  };
};

type OfficialResult = null | {
  turnoutPercent: number | null;
  yesPercent: number | null;
  noPercent: number | null;
  updatedAt: string;
};

type BallotBase = {
  id: string;
  civicProcessId: string;
  title: string;
  ballotKind: string;
  question: string;
  yesMeaning: string;
  noMeaning: string;
  opensAt: string;
  closesAt: string;
  timezone: string;
  source: {
    id: string;
    url: string;
    officialReference: string | null;
    canonicalUrl: string | null;
  };
  forecast: Forecast;
  officialResult: OfficialResult;
};

type Ballot = BallotBase & {
  currentChoice: Choice | null;
  cooldown: { isBlocked: boolean; unlockDate: string | null };
};

type HistoricalBallot = BallotBase & {
  forecastFrozenAt: string;
};

type GeographyRow = {
  level: "region" | "province" | "municipality";
  region: string | null;
  province: string | null;
  municipality: string | null;
  forecast: Forecast;
};

type Geography = {
  minimumResponses: number;
  regions: GeographyRow[];
  provinces: GeographyRow[];
  municipalities: GeographyRow[];
};

type TrendPoint = {
  at: string;
  isFrozen: boolean;
  forecast: Forecast;
};

const choices: Array<{
  value: Choice;
  label: string;
  description: (ballot: Ballot) => string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "YES", label: "Sì", description: (ballot) => ballot.yesMeaning, icon: CheckCircle2 },
  { value: "NO", label: "No", description: (ballot) => ballot.noMeaning, icon: XCircle },
  { value: "ABSTAIN", label: "Non voterei", description: () => "Non parteciperei a questo referendum.", icon: MinusCircle },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function formatDateShort(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPercent(value?: number | null) {
  return value == null ? "—" : `${value.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`;
}

function ForecastGrid({ forecast, frozen = false }: { forecast: Forecast; frozen?: boolean }) {
  if (forecast.suppressed) {
    return (
      <div className="text-sm text-slate-600">
        {frozen ? "La previsione finale" : "I risultati"} {forecast.totalResponses > 0 ? `ha ${forecast.totalResponses} risposte` : "non ha abbastanza risposte"}. Sono necessarie almeno {forecast.minimumResponses} risposte per mostrare gli aggregati.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><div className="text-xs text-slate-500">Affluenza {frozen ? "prevista" : "prevista"}</div><div className="text-xl font-semibold">{formatPercent(forecast.turnoutPercent)}</div></div>
        <div><div className="text-xs text-slate-500">Sì tra i votanti</div><div className="text-xl font-semibold">{formatPercent(forecast.yesPercent)}</div></div>
        <div><div className="text-xs text-slate-500">No tra i votanti</div><div className="text-xl font-semibold">{formatPercent(forecast.noPercent)}</div></div>
        <div><div className="text-xs text-slate-500">Non voterei</div><div className="text-xl font-semibold">{formatPercent(forecast.abstainPercent)}</div></div>
      </div>
      {forecast.quorum?.required && forecast.quorum.forecastReached !== null && (
        <div className="mt-3 text-sm font-medium text-slate-700">
          Quorum previsto: {forecast.quorum.forecastReached ? "raggiunto" : "non raggiunto"}
          {forecast.quorum.thresholdPercent != null ? ` (soglia ${formatPercent(forecast.quorum.thresholdPercent)})` : ""}.
        </div>
      )}
    </>
  );
}

function OfficialResultGrid({ result }: { result: OfficialResult }) {
  if (!result) {
    return <div className="text-sm text-slate-600">Risultato ufficiale non ancora disponibile.</div>;
  }
  return (
    <div className="grid grid-cols-3 gap-3">
      <div><div className="text-xs text-slate-500">Affluenza reale</div><div className="text-xl font-semibold">{formatPercent(result.turnoutPercent)}</div></div>
      <div><div className="text-xs text-slate-500">Sì reali</div><div className="text-xl font-semibold">{formatPercent(result.yesPercent)}</div></div>
      <div><div className="text-xs text-slate-500">No reali</div><div className="text-xl font-semibold">{formatPercent(result.noPercent)}</div></div>
    </div>
  );
}

function geographyLabel(row: GeographyRow) {
  if (row.level === "municipality") return [row.municipality, row.province, row.region].filter(Boolean).join(" · ");
  if (row.level === "province") return [row.province, row.region].filter(Boolean).join(" · ");
  return row.region || "Territorio";
}

function GeographyList({ title, rows }: { title: string; rows: GeographyRow[] }) {
  const visible = rows.slice(0, 6);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 text-sm font-semibold text-slate-800">{title}</div>
      {visible.length === 0 ? (
        <div className="text-xs text-slate-500">Nessun territorio supera ancora la soglia privacy.</div>
      ) : (
        <div className="space-y-2">
          {visible.map((row, index) => (
            <div key={`${row.level}-${geographyLabel(row)}-${index}`} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
              <div className="text-xs font-medium text-slate-700">{geographyLabel(row)}</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                <span>Affluenza {formatPercent(row.forecast.turnoutPercent)}</span>
                <span>Sì {formatPercent(row.forecast.yesPercent)}</span>
                <span>No {formatPercent(row.forecast.noPercent)}</span>
                <span>n={row.forecast.totalResponses}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BallotInsights({ ballotId, showGeography = true }: { ballotId: string; showGeography?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [geography, setGeography] = useState<Geography | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (!nextExpanded || loaded) return;

    setLoading(true);
    setError(null);
    try {
      const requests: Promise<any>[] = [apiRequest("GET", `/api/referendum/vote-real/${ballotId}/trend`)];
      if (showGeography) requests.push(apiRequest("GET", `/api/referendum/vote-real/${ballotId}/geography`));
      const responses = await Promise.all(requests);
      setTrend(Array.isArray(responses[0]?.data?.trend) ? responses[0].data.trend : []);
      if (showGeography) {
        setGeography({
          minimumResponses: Number(responses[1]?.data?.minimumResponses || 10),
          regions: Array.isArray(responses[1]?.data?.regions) ? responses[1].data.regions : [],
          provinces: Array.isArray(responses[1]?.data?.provinces) ? responses[1].data.provinces : [],
          municipalities: Array.isArray(responses[1]?.data?.municipalities) ? responses[1].data.municipalities : [],
        });
      }
      setLoaded(true);
    } catch (err: any) {
      setError(err?.data?.message || err?.message || "Impossibile caricare le statistiche dettagliate.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => void open()}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-800"
      >
        <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Territori e andamento</span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="space-y-4 border-t border-slate-200 p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Caricamento statistiche…</div>
          ) : error ? (
            <div className="text-sm text-red-700">{error}</div>
          ) : (
            <>
              {showGeography && geography && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><MapPin className="h-4 w-4" /> Previsione per residenza</div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <GeographyList title="Regioni" rows={geography.regions} />
                    <GeographyList title="Province" rows={geography.provinces} />
                    <GeographyList title="Comuni" rows={geography.municipalities} />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Sono mostrati solo territori con almeno {geography.minimumResponses} risposte.</div>
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><History className="h-4 w-4" /> Andamento della previsione</div>
                {trend.length === 0 ? (
                  <div className="text-sm text-slate-500">Lo storico comparirà quando la previsione avrà almeno 10 risposte.</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500">
                        <tr><th className="px-3 py-2 text-left">Momento</th><th className="px-3 py-2 text-right">Affluenza</th><th className="px-3 py-2 text-right">Sì</th><th className="px-3 py-2 text-right">No</th></tr>
                      </thead>
                      <tbody>
                        {trend.slice(-12).map((point) => (
                          <tr key={point.at} className="border-t border-slate-100">
                            <td className="px-3 py-2">{formatDateShort(point.at)}{point.isFrozen ? " · finale" : ""}</td>
                            <td className="px-3 py-2 text-right">{formatPercent(point.forecast.turnoutPercent)}</td>
                            <td className="px-3 py-2 text-right">{formatPercent(point.forecast.yesPercent)}</td>
                            <td className="px-3 py-2 text-right">{formatPercent(point.forecast.noPercent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function VotaReferendum() {
  const [ballots, setBallots] = useState<Ballot[]>([]);
  const [history, setHistory] = useState<HistoricalBallot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [activeResponse, historyResponse] = await Promise.all([
        apiRequest("GET", "/api/referendum/vote-real"),
        apiRequest("GET", "/api/referendum/vote-real/history?limit=10"),
      ]);
      setBallots(Array.isArray(activeResponse?.data?.ballots) ? activeResponse.data.ballots : []);
      setHistory(Array.isArray(historyResponse?.data?.ballots) ? historyResponse.data.ballots : []);
    } catch (err: any) {
      setError(err?.data?.message || err?.message || "Impossibile caricare i referendum.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const choose = async (ballot: Ballot, choice: Choice) => {
    if (ballot.currentChoice === choice) return;
    setSavingId(ballot.id);
    setError(null);
    try {
      await apiRequest("POST", `/api/referendum/vote-real/${ballot.id}/choice`, { choice });
      await load();
    } catch (err: any) {
      if (err?.data?.error === "PREFERENCE_COOLDOWN" && err?.data?.unlockDate) {
        setError(`Potrai cambiare questa scelta dal ${formatDate(err.data.unlockDate)}.`);
      } else {
        setError(err?.data?.message || err?.message || "Non è stato possibile salvare la scelta.");
      }
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen page-with-navbar flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-label="Caricamento" />
      </div>
    );
  }

  return (
    <div className="min-h-screen page-with-navbar bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Vote className="h-6 w-6 text-red-600" />
              Referendum
            </CardTitle>
            <CardDescription>
              Come voteresti nei referendum realmente convocati? Questa è una previsione DEMOS, non il voto istituzionale espresso ai seggi.
            </CardDescription>
          </CardHeader>
        </Card>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}

        {ballots.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-600">
              Non ci sono referendum ufficialmente convocati disponibili per il voto DEMOS in questo momento.
            </CardContent>
          </Card>
        ) : (
          ballots.map((ballot) => {
            const isSaving = savingId === ballot.id;
            return (
              <Card key={ballot.id} className="overflow-hidden">
                <CardHeader className="space-y-3">
                  <div>
                    <CardTitle className="text-xl leading-snug">{ballot.title}</CardTitle>
                    <CardDescription className="mt-1">
                      Previsione DEMOS aperta fino al {formatDate(ballot.opensAt)}
                    </CardDescription>
                  </div>
                  <div className="rounded-xl bg-slate-100 p-4 text-sm leading-relaxed text-slate-800">
                    <div className="mb-1 font-semibold">Quesito ufficiale</div>
                    {ballot.question}
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                    <div className="font-semibold">Cosa significa votare Sì?</div>
                    <div className="mt-1">{ballot.yesMeaning}</div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    {choices.map(({ value, label, description, icon: Icon }) => {
                      const selected = ballot.currentChoice === value;
                      const blocked = ballot.cooldown.isBlocked && !selected;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => void choose(ballot, value)}
                          disabled={isSaving || blocked}
                          className={`rounded-2xl border p-4 text-left transition ${
                            selected
                              ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200"
                              : "border-slate-200 bg-white hover:border-slate-400"
                          } disabled:cursor-not-allowed disabled:opacity-55`}
                          aria-pressed={selected}
                        >
                          <div className="flex items-center gap-2 font-semibold text-slate-900">
                            {isSaving && !selected ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                            {label}
                          </div>
                          <div className="mt-2 text-sm leading-snug text-slate-600">{description(ballot)}</div>
                        </button>
                      );
                    })}
                  </div>

                  {ballot.cooldown.isBlocked && ballot.cooldown.unlockDate && (
                    <div className="text-sm text-slate-600">
                      Scelta salvata. Potrai cambiarla dal {formatDate(ballot.cooldown.unlockDate)}.
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 font-semibold text-slate-900">Previsione DEMOS</div>
                    <ForecastGrid forecast={ballot.forecast} />
                  </div>

                  <BallotInsights ballotId={ballot.id} />

                  <a
                    href={ballot.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline"
                  >
                    Fonte ufficiale <ExternalLink className="h-4 w-4" />
                  </a>
                </CardContent>
              </Card>
            );
          })
        )}

        {history.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 px-1">
              <History className="h-5 w-5 text-slate-700" />
              <h2 className="text-xl font-semibold text-slate-900">Archivio e confronto</h2>
            </div>
            {history.map((ballot) => (
              <Card key={`history-${ballot.id}`} className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg leading-snug">{ballot.title}</CardTitle>
                  <CardDescription>Previsione congelata all'apertura dei seggi: {formatDate(ballot.opensAt)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl bg-slate-100 p-3 text-sm leading-relaxed text-slate-800">
                    <div className="mb-1 font-semibold">Quesito ufficiale</div>
                    {ballot.question}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <div className="mb-3 font-semibold text-blue-950">Previsione finale DEMOS</div>
                      <ForecastGrid forecast={ballot.forecast} frozen />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="mb-3 font-semibold text-slate-900">Risultato ufficiale</div>
                      <OfficialResultGrid result={ballot.officialResult} />
                      {ballot.officialResult?.updatedAt && (
                        <div className="mt-2 text-xs text-slate-500">Aggiornato: {formatDate(ballot.officialResult.updatedAt)}</div>
                      )}
                    </div>
                  </div>
                  <BallotInsights ballotId={ballot.id} />
                  <a
                    href={ballot.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline"
                  >
                    Fonte ufficiale <ExternalLink className="h-4 w-4" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
