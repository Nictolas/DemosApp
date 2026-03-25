import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, CheckCircle2, Gauge, Info, RefreshCw } from "lucide-react";

type FreeMetric = {
  id: string;
  label: string;
  used: number | null;
  limit: number | null;
  unit: string;
  note: string;
};

type Platform = {
  id: string;
  name: string;
  description: string;
  metrics: FreeMetric[];
};

type PlatformUsageApi = {
  generatedAt?: string;
  diagnostics?: {
    neon?: string[];
  };
  sources?: Record<string, string>;
  platforms?: {
    neon?: {
      updatedAt?: string;
      metrics?: {
        databaseSizeBytes?: number | null;
        activeConnections?: number | null;
        projectCount?: number | null;
        computeUnitSeconds30d?: number | null;
        dataTransferBytes30d?: number | null;
      };
      limits?: {
        computeUnitSecondsLimit30d?: number | null;
        databaseStorageBudgetBytes?: number | null;
        dataTransferBudgetBytes?: number | null;
        activeConnectionsLimit?: number | null;
      };
    };
    render?: {
      updatedAt?: string;
      metrics?: { diskUsedBytes?: number | null; diskTotalBytes?: number | null; diskIsEstimated?: boolean };
    };
    axiom?: {
      updatedAt?: string;
      metrics?: { integrationEnabled?: boolean; hasToken?: boolean; hasOrg?: boolean };
    };
    firebase?: {
      updatedAt?: string;
      metrics?: { configured?: boolean };
    };
    resend?: {
      updatedAt?: string;
      metrics?: { configured?: boolean };
    };
    play?: {
      updatedAt?: string;
      metrics?: { configured?: boolean };
    };
  };
};

const BASE_PLATFORMS: Platform[] = [
  {
    id: "neon",
    name: "Neon (Database)",
    description: "Database PostgreSQL principale dell'app (fonte: DPIA + configurazione progetto).",
    metrics: [
      {
        id: "neon-compute-30d",
        label: "Compute (30 giorni)",
        used: null,
        limit: null,
        unit: "CU-hrs",
        note:
          "Consumo compute (ultimi 30 giorni) dall'API Neon. L'aggiornamento automatico in questa pagina è disponibile solo con un piano Neon che espone l'API consumption ufficiale (es. Launch, Scale, Agent, Enterprise). Sul piano Free i consumi restano visibili nella console Neon, non via API."
      },
      { id: "neon-storage", label: "Storage database", used: null, limit: null, unit: "GB", note: "Dimensione live del DB, confrontata col budget storage configurato." },
      {
        id: "neon-data-transfer-30d",
        label: "Data transfer (30 giorni)",
        used: null,
        limit: null,
        unit: "GB",
        note:
          "Traffico dati (ultimi 30 giorni) dall'API Neon. Come per il compute, l'aggiornamento automatico richiede un piano con API consumption supportata; sul piano Free l'API può rispondere 403."
      },
      { id: "neon-active-connections", label: "Connessioni attive DB", used: null, limit: null, unit: "connessioni", note: "Dato live dal DB, confrontato col limite configurato." }
    ]
  },
  {
    id: "render",
    name: "Render (Backend + Frontend)",
    description: "Hosting API e web app (fonte: DPIA architettura tecnica).",
    metrics: [
      { id: "render-disk", label: "Disco server app", used: null, limit: null, unit: "GB", note: "Valore live dal server applicativo quando disponibile." }
    ]
  },
  {
    id: "axiom",
    name: "Axiom (Log centralizzati)",
    description: "Integrazione log centralizzati e alert (stato configurazione runtime).",
    metrics: [
      { id: "axiom-config", label: "Configurazione integrazione", used: null, limit: 1, unit: "stato", note: "100% = AXIOM_ENABLED + token + org configurati. 0% = mancano variabili di ambiente." }
    ]
  },
  {
    id: "firebase",
    name: "Firebase (push / servizi)",
    description: "Configurazione servizi Firebase usati dall'app (stato runtime).",
    metrics: [
      { id: "firebase-config", label: "Configurazione", used: null, limit: 1, unit: "stato", note: "100% = variabili FIREBASE_* presenti. 0% = configurazione mancante." }
    ]
  },
  {
    id: "resend",
    name: "Resend (Email)",
    description: "Invio email transazionali (stato runtime).",
    metrics: [
      { id: "resend-config", label: "Configurazione", used: null, limit: 1, unit: "stato", note: "100% = RESEND_API_KEY presente. 0% = configurazione mancante." }
    ]
  },
  {
    id: "play",
    name: "Google Play (review/admin)",
    description: "Credenziali admin per gestione review (stato runtime).",
    metrics: [
      { id: "play-config", label: "Configurazione", used: null, limit: 1, unit: "stato", note: "100% = email+password admin configurate. 0% = configurazione mancante." }
    ]
  }
];

function getPercent(used: number | null, limit: number | null): number {
  if (used === null || limit === null || limit <= 0) return 0;
  return Math.max(0, Math.min(100, Number((((used || 0) / limit) * 100).toFixed(1))));
}

function hasProgress(metric: FreeMetric): boolean {
  return metric.used !== null && metric.limit !== null && metric.limit > 0;
}

function hasLiveValueWithoutLimit(metric: FreeMetric): boolean {
  return metric.used !== null && (metric.limit === null || metric.limit <= 0);
}

function bytesToGb(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Number((value / 1024 / 1024 / 1024).toFixed(2));
}

function secondsToCuHours(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Number((value / 3600).toFixed(2));
}

function isConfiguredMetric(metricId: string): boolean {
  return ["axiom-config", "firebase-config", "resend-config", "play-config"].includes(metricId);
}

/** Soglie fisse per uso risorse (quota): sotto 70% verde, 70–89% giallo, ≥90% rosso */
const THRESHOLD_USAGE_WARN = 70;
const THRESHOLD_USAGE_CRIT = 90;

function usageQuotaBarClass(percent: number): string {
  const p = Number(percent);
  if (!Number.isFinite(p)) return "bg-emerald-500";
  if (p >= THRESHOLD_USAGE_CRIT) return "bg-red-500";
  if (p >= THRESHOLD_USAGE_WARN) return "bg-amber-500";
  return "bg-emerald-500";
}

/** Barra “completamento integrazioni”: più alto è meglio (100% = tutto ok). */
function integrationCompletionBarClass(percent: number): string {
  const p = Number(percent);
  if (!Number.isFinite(p)) return "bg-slate-400";
  if (p >= 100) return "bg-emerald-500";
  if (p >= THRESHOLD_USAGE_WARN) return "bg-amber-500";
  return "bg-red-500";
}

function configStatusBarClass(percent: number): string {
  return percent >= 100 ? "bg-emerald-500" : "bg-amber-500";
}

/** Metriche Neon che dipendono dall'API consumption (spesso non disponibile sul piano Free). */
function isNeonConsumptionApiMetric(metricId: string): boolean {
  return metricId === "neon-compute-30d" || metricId === "neon-data-transfer-30d";
}

function isNeonConsumption403(diagnostics?: string[]): boolean {
  if (!diagnostics?.length) return false;
  return diagnostics.some((line) => {
    const s = String(line);
    return s.includes("consumption history HTTP 403") || (s.includes("consumption_history") && s.includes("HTTP 403"));
  });
}

function getPlatformRiskPercent(platform: Platform): number | null {
  const percents = platform.metrics.filter(hasProgress).map((m) => getPercent(m.used, m.limit));
  return percents.length ? Math.max(...percents) : null;
}

function formatUpdatedAt(value?: string): string {
  if (!value) return "N/D";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

const Parametri: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [platformUsage, setPlatformUsage] = useState<PlatformUsageApi | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPlatformUsage = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await apiRequest("GET", "/admin/monitoring/platform-usage");
      const serverPayload = (response as any)?.data ?? response;
      const data = serverPayload?.data ?? serverPayload;
      if (serverPayload?.success === true && data) setPlatformUsage(data);
      else setLoadError("Endpoint parametri non disponibile.");
    } catch (_error) {
      setLoadError("Impossibile caricare i parametri live dal backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlatformUsage();
    const timer = setInterval(loadPlatformUsage, 60_000);
    return () => clearInterval(timer);
  }, []);

  const platforms = useMemo(() => {
    const neon = platformUsage?.platforms?.neon?.metrics;
    const neonLimits = platformUsage?.platforms?.neon?.limits;
    const render = platformUsage?.platforms?.render?.metrics;
    const axiom = platformUsage?.platforms?.axiom?.metrics;
    const firebase = platformUsage?.platforms?.firebase?.metrics;
    const resend = platformUsage?.platforms?.resend?.metrics;
    const play = platformUsage?.platforms?.play?.metrics;

    const mapped = BASE_PLATFORMS.map((platform) => ({
      ...platform,
      metrics: platform.metrics.map((metric) => {
        if (metric.id === "neon-compute-30d") {
          const hasApi = typeof neon?.computeUnitSeconds30d === "number";
          return {
            ...metric,
            used: secondsToCuHours(neon?.computeUnitSeconds30d),
            limit: secondsToCuHours(neonLimits?.computeUnitSecondsLimit30d),
            note: hasApi
              ? "Dato aggiornato automaticamente dall'API Neon (consumption), confrontato col limite impostato in app."
              : metric.note
          };
        }
        if (metric.id === "neon-storage") {
          return {
            ...metric,
            used: bytesToGb(neon?.databaseSizeBytes),
            limit: bytesToGb(neonLimits?.databaseStorageBudgetBytes),
            note: neonLimits?.databaseStorageBudgetBytes
              ? metric.note
              : "Limite/budget non configurato: imposta NEON_DB_STORAGE_BUDGET_BYTES per avere la %."
          };
        }
        if (metric.id === "neon-data-transfer-30d") {
          const hasApi = typeof neon?.dataTransferBytes30d === "number";
          return {
            ...metric,
            used: bytesToGb(neon?.dataTransferBytes30d),
            limit: bytesToGb(neonLimits?.dataTransferBudgetBytes),
            note: hasApi
              ? "Dato aggiornato automaticamente dall'API Neon (consumption), confrontato col limite impostato in app."
              : metric.note
          };
        }
        if (metric.id === "neon-active-connections") {
          return {
            ...metric,
            used: neon?.activeConnections ?? null,
            limit: neonLimits?.activeConnectionsLimit ?? null,
            note: neonLimits?.activeConnectionsLimit
              ? metric.note
              : "Limite non configurato: imposta NEON_ACTIVE_CONNECTIONS_LIMIT per avere la %."
          };
        }
        if (metric.id === "render-disk") {
          return {
            ...metric,
            used: bytesToGb(render?.diskUsedBytes),
            limit: bytesToGb(render?.diskTotalBytes),
            note: render?.diskIsEstimated ? "Valore live stimato (fallback). Se possibile usa misura reale da server." : metric.note
          };
        }
        if (metric.id === "axiom-config") {
          const configured = Boolean(axiom?.integrationEnabled && axiom?.hasToken && axiom?.hasOrg);
          return { ...metric, used: configured ? 1 : 0, limit: 1, unit: "", note: configured ? "Configurazione OK." : "Configurazione incompleta: verifica AXIOM_ENABLED, AXIOM_API_TOKEN, AXIOM_ORG_ID." };
        }
        if (metric.id === "firebase-config") {
          const configured = Boolean(firebase?.configured);
          return { ...metric, used: configured ? 1 : 0, limit: 1, unit: "", note: configured ? "Configurazione OK." : "Configurazione mancante: verifica variabili FIREBASE_*." };
        }
        if (metric.id === "resend-config") {
          const configured = Boolean(resend?.configured);
          return { ...metric, used: configured ? 1 : 0, limit: 1, unit: "", note: configured ? "Configurazione OK." : "Configurazione mancante: verifica RESEND_API_KEY." };
        }
        if (metric.id === "play-config") {
          const configured = Boolean(play?.configured);
          return { ...metric, used: configured ? 1 : 0, limit: 1, unit: "", note: configured ? "Configurazione OK." : "Configurazione mancante: verifica PLAY_REVIEW_ADMIN_EMAIL e PLAY_REVIEW_ADMIN_PASSWORD." };
        }
        return metric;
      })
    }));

    return mapped.sort((a, b) => {
      const risk = (p: Platform) => {
        const values = p.metrics.filter(hasProgress).map((m) => getPercent(m.used, m.limit));
        return values.length ? Math.max(...values) : -1;
      };
      return risk(b) - risk(a);
    });
  }, [platformUsage]);

  const lastUpdated = platformUsage?.generatedAt ? new Date(platformUsage.generatedAt).toLocaleString() : "N/D";

  const neonConsumptionBlocked = useMemo(
    () => isNeonConsumption403(platformUsage?.diagnostics?.neon),
    [platformUsage]
  );

  const overview = useMemo(() => {
    const allMetrics = platforms.flatMap((p) => p.metrics);
    const configuredMetrics = allMetrics.filter((m) => isConfiguredMetric(m.id));
    const configuredDone = configuredMetrics.filter((m) => m.used === 1).length;
    const configuredTotal = configuredMetrics.length || 0;
    const configuredPercent = configuredTotal > 0 ? Number(((configuredDone / configuredTotal) * 100).toFixed(1)) : 0;

    const progressMetrics = allMetrics.filter(hasProgress).filter((m) => !isConfiguredMetric(m.id));
    const atRisk = progressMetrics
      .map((m) => ({ metric: m, percent: getPercent(m.used, m.limit) }))
      .sort((a, b) => b.percent - a.percent)[0];

    return {
      configuredDone,
      configuredTotal,
      configuredPercent,
      highestUsage: atRisk?.percent ?? null,
      highestUsageLabel: atRisk?.metric?.label ?? null
    };
  }, [platforms]);

  const getStatus = (percent: number): { label: string; tone: string; icon: React.ReactNode } => {
    if (percent >= THRESHOLD_USAGE_CRIT) return { label: "Critico", tone: "bg-red-100 text-red-700 border-red-300", icon: <AlertTriangle className="h-3.5 w-3.5" /> };
    if (percent >= THRESHOLD_USAGE_WARN) return { label: "Attenzione", tone: "bg-amber-100 text-amber-700 border-amber-300", icon: <Gauge className="h-3.5 w-3.5" /> };
    return { label: "OK", tone: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: <CheckCircle2 className="h-3.5 w-3.5" /> };
  };

  return (
    <div className="w-full min-h-screen bg-[radial-gradient(ellipse_at_top,_#e0f2fe_0%,_#f8fafc_42%,_#ffffff_100%)] pt-20 pb-12">
      <div className="w-full max-w-none mx-auto px-4 sm:px-6 lg:px-10 xl:px-12">
        {/* Intestazione: due colonne su desktop */}
        <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white/90 p-5 sm:p-7 shadow-md shadow-slate-200/40 backdrop-blur-sm">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="min-w-0 flex-1">
              <Badge variant="outline" className="mb-3 text-cyan-700 border-cyan-300 bg-cyan-50/80">
                Parametri Piani Free
              </Badge>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-2">Parametri</h1>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed max-w-4xl">
                Limiti principali delle piattaforme free usate nell&apos;app, con barre per vedere subito quanto margine resta.
              </p>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed max-w-4xl">
                Lista piattaforme da DPIA e configurazioni progetto. Dove il provider non espone il consumo in-app, la voce è marcata come manuale.
              </p>
              <p className="text-xs text-slate-600 mt-2 font-medium max-w-4xl">
                Uso risorse (quota): sotto {THRESHOLD_USAGE_WARN}% verde · {THRESHOLD_USAGE_WARN}–{THRESHOLD_USAGE_CRIT - 1}% giallo · {THRESHOLD_USAGE_CRIT}% o più rosso.
              </p>
            </div>
            <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2 lg:items-end lg:min-w-[280px]">
              <Badge variant="outline" className="text-slate-700 border-slate-300 justify-center sm:justify-start">
                Ultimo aggiornamento: {lastUpdated}
              </Badge>
              <Badge variant="outline" className="text-slate-600 border-slate-300 text-xs font-normal justify-center sm:justify-start break-all">
                /api/admin/monitoring/platform-usage
              </Badge>
              <Button variant="default" size="sm" className="bg-cyan-700 hover:bg-cyan-800 w-full sm:w-auto" onClick={loadPlatformUsage} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Aggiorna adesso
              </Button>
            </div>
          </div>
          {loadError && <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{loadError}</p>}
        </div>

        {/* Riga superiore: due colonne su lg */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 mb-8">
          <Card className="border-slate-200/80 bg-white/95 shadow-sm hover:shadow-md transition-shadow min-h-[200px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Riepilogo completamento</CardTitle>
              <CardDescription>Configurazione integrazioni e uso risorse con quota.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">Integrazioni</p>
                  <Badge variant="outline" className="text-slate-700 border-slate-300">
                    {overview.configuredDone}/{overview.configuredTotal}
                  </Badge>
                </div>
                <Progress
                  value={overview.configuredPercent}
                  className="h-2.5"
                  indicatorClassName={integrationCompletionBarClass(overview.configuredPercent)}
                />
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{overview.configuredPercent}% completato</span>
                  <span>{overview.configuredTotal ? "obiettivo 100%" : "N/D"}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">Risorsa più alta</p>
                  {typeof overview.highestUsage === "number" ? (
                    <Badge variant="outline" className={`inline-flex items-center gap-1 ${getStatus(overview.highestUsage).tone}`}>
                      {getStatus(overview.highestUsage).icon}
                      {getStatus(overview.highestUsage).label}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-700 border-slate-300">
                      N/D
                    </Badge>
                  )}
                </div>
                <Progress
                  value={overview.highestUsage ?? 0}
                  className={`h-2.5 ${overview.highestUsage === null ? "opacity-40" : ""}`}
                  indicatorClassName={overview.highestUsage === null ? "bg-slate-400" : usageQuotaBarClass(overview.highestUsage)}
                />
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="line-clamp-2">{overview.highestUsageLabel ?? "Nessuna quota"}</span>
                  <span>{overview.highestUsage !== null ? `${overview.highestUsage}%` : "N/D"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/95 shadow-sm hover:shadow-md transition-shadow min-h-[200px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Limiti API / piano</CardTitle>
              <CardDescription>Cosa non è leggibile in automatico da qui.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 space-y-2 max-h-[200px] xl:max-h-none overflow-y-auto xl:overflow-visible pr-1">
              <p>
                <span className="font-medium text-slate-800">Neon (consumption):</span> API{" "}
                <code className="text-[11px] bg-slate-100 px-1 rounded">consumption_history</code> spesso 403 sul Free.{" "}
                <a className="text-cyan-700 underline font-medium" href="https://neon.tech/docs/guides/consumption-metrics" target="_blank" rel="noreferrer">
                  Guida Neon
                </a>
                .
              </p>
              <p className="text-xs text-slate-500">Render billing, Firebase/Resend quote: non esposte uniformemente qui.</p>
            </CardContent>
          </Card>
        </div>

        {/* Griglia piattaforme: 2 colonne su tablet, 3 su desktop largo */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6">
        {platforms.map((platform) => (
          <Card key={platform.id} className="border-slate-200/80 bg-white/95 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-lg leading-snug">{platform.name}</CardTitle>
                {(() => {
                  const risk = getPlatformRiskPercent(platform);
                  if (risk === null) return null;
                  const status = getStatus(risk);
                  return (
                    <Badge variant="outline" className={`shrink-0 inline-flex items-center gap-1 text-xs ${status.tone}`}>
                      {status.icon}
                      {risk}%
                    </Badge>
                  );
                })()}
              </div>
              <CardDescription className="space-y-2">
                <span className="block text-sm">{platform.description}</span>
                <span className="block text-xs text-slate-500">
                  Aggiornato: {formatUpdatedAt((platformUsage as any)?.platforms?.[platform.id]?.updatedAt)}
                </span>
              </CardDescription>
              {(() => {
                const risk = getPlatformRiskPercent(platform);
                if (risk === null) return null;
                const status = getStatus(risk);
                return (
                  <div className="mt-2 rounded-lg border border-slate-200/70 bg-gradient-to-r from-slate-50/90 to-cyan-50/40 p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-700">Rischio max piattaforma</p>
                      <Badge variant="outline" className={`text-xs ${status.tone}`}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="mt-1.5">
                      <Progress value={risk} className="h-2" indicatorClassName={usageQuotaBarClass(risk)} />
                    </div>
                  </div>
                );
              })()}
              {platform.id === "neon" && neonConsumptionBlocked ? (
                <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/90 p-3 text-xs text-violet-950">
                  <p className="font-medium">Compute / Data transfer</p>
                  <p className="mt-1.5 leading-relaxed text-violet-900/90">
                    API consumo 403 su questo piano: valori live solo con piano che esponga l&apos;API consumption. Consulta la console Neon.
                  </p>
                </div>
              ) : null}
              {platform.id === "neon" && !neonConsumptionBlocked && platformUsage?.diagnostics?.neon?.length ? (
                <p className="text-xs text-amber-700 mt-1 break-words">Neon: {platformUsage.diagnostics.neon.join(" | ")}</p>
              ) : null}
            </CardHeader>
            <CardContent
              className={`flex-1 pt-0 ${platform.metrics.length > 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-4"}`}
            >
              {platform.metrics.map((metric) => {
                const percent = getPercent(metric.used, metric.limit);
                const progressEnabled = hasProgress(metric);
                const liveValueNoLimit = hasLiveValueWithoutLimit(metric);
                const isConfig = isConfiguredMetric(metric.id);
                const premiumBlocked =
                  platform.id === "neon" &&
                  isNeonConsumptionApiMetric(metric.id) &&
                  neonConsumptionBlocked &&
                  !progressEnabled &&
                  !liveValueNoLimit;
                const status = progressEnabled ? getStatus(percent) : { label: "Da configurare", tone: "bg-slate-100 text-slate-700 border-slate-300", icon: <Info className="h-3.5 w-3.5" /> };
                const finalStatus = premiumBlocked
                  ? { label: "Solo piano premium", tone: "bg-violet-100 text-violet-800 border-violet-300", icon: <Info className="h-3.5 w-3.5" /> }
                  : liveValueNoLimit
                    ? { label: "Dato live", tone: "bg-blue-100 text-blue-700 border-blue-300", icon: <Info className="h-3.5 w-3.5" /> }
                    : isConfig
                      ? (metric.used === 1
                        ? { label: "Configurato", tone: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: <CheckCircle2 className="h-3.5 w-3.5" /> }
                        : { label: "Non configurato", tone: "bg-amber-100 text-amber-700 border-amber-300", icon: <AlertTriangle className="h-3.5 w-3.5" /> })
                      : status;
                const barTint =
                  !progressEnabled
                    ? undefined
                    : premiumBlocked
                      ? "bg-slate-400"
                      : isConfig
                        ? configStatusBarClass(percent)
                        : usageQuotaBarClass(percent);
                return (
                  <div key={metric.id} className="space-y-2 rounded-xl border border-slate-200/60 bg-white/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{metric.label}</p>
                      <Badge variant="outline" className={`inline-flex items-center gap-1 ${finalStatus.tone}`}>{finalStatus.icon}{finalStatus.label}</Badge>
                    </div>
                    <Progress
                      value={percent}
                      className={`h-2.5 ${!progressEnabled ? "opacity-40" : ""}`}
                      indicatorClassName={barTint}
                    />
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      {progressEnabled ? (
                        <>
                          <span>
                            {isConfig
                              ? (metric.used === 1 ? "OK" : "Manca configurazione")
                              : `${metric.used} ${metric.unit} su ${metric.limit} ${metric.unit}`.trim()}
                          </span>
                          <span>{percent}%</span>
                        </>
                      ) : liveValueNoLimit ? (
                        <>
                          <span>{metric.used} {metric.unit}</span>
                          <span>N/A quota</span>
                        </>
                      ) : premiumBlocked ? (
                        <>
                          <span>API non disponibile sul piano Free; aggiornamento automatico solo con piano Neon premium (consumption API)</span>
                          <span>—</span>
                        </>
                      ) : (
                        <>
                          <span>Valore non disponibile automaticamente</span>
                          <span>N/D</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 inline-flex items-start gap-1.5"><Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>{metric.note}</span></p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
        </div>
      </div>
    </div>
  );
};

export default Parametri;
