import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, MinusCircle, Vote, XCircle, CheckCircle2 } from "lucide-react";
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

type Ballot = {
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
  currentChoice: Choice | null;
  cooldown: { isBlocked: boolean; unlockDate: string | null };
  forecast: Forecast;
  officialResult: null | {
    turnoutPercent: number | null;
    yesPercent: number | null;
    noPercent: number | null;
    updatedAt: string;
  };
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

function formatPercent(value?: number | null) {
  return value == null ? "—" : `${value.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`;
}

export default function VotaReferendum() {
  const [ballots, setBallots] = useState<Ballot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await apiRequest("GET", "/api/referendum-vote");
      setBallots(Array.isArray(response?.data?.ballots) ? response.data.ballots : []);
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
      await apiRequest("POST", `/api/referendum-vote/${ballot.id}/choice`, { choice });
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
                    <div className="font-semibold text-slate-900">Previsione DEMOS</div>
                    {ballot.forecast.suppressed ? (
                      <div className="mt-2 text-sm text-slate-600">
                        I risultati saranno visibili da {ballot.forecast.minimumResponses} risposte, per proteggere la privacy.
                      </div>
                    ) : (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div><div className="text-xs text-slate-500">Affluenza prevista</div><div className="text-xl font-semibold">{formatPercent(ballot.forecast.turnoutPercent)}</div></div>
                          <div><div className="text-xs text-slate-500">Sì tra i votanti</div><div className="text-xl font-semibold">{formatPercent(ballot.forecast.yesPercent)}</div></div>
                          <div><div className="text-xs text-slate-500">No tra i votanti</div><div className="text-xl font-semibold">{formatPercent(ballot.forecast.noPercent)}</div></div>
                          <div><div className="text-xs text-slate-500">Non voterei</div><div className="text-xl font-semibold">{formatPercent(ballot.forecast.abstainPercent)}</div></div>
                        </div>
                        {ballot.forecast.quorum?.required && ballot.forecast.quorum.forecastReached !== null && (
                          <div className="mt-3 text-sm font-medium text-slate-700">
                            Quorum previsto: {ballot.forecast.quorum.forecastReached ? "raggiunto" : "non raggiunto"}
                            {ballot.forecast.quorum.thresholdPercent != null ? ` (soglia ${formatPercent(ballot.forecast.quorum.thresholdPercent)})` : ""}.
                          </div>
                        )}
                      </>
                    )}
                  </div>

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
      </div>
    </div>
  );
}
