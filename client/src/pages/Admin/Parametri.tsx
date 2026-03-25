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
    cie?: {
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
      { id: "neon-compute-30d", label: "Compute (30 giorni)", used: null, limit: null, unit: "CU-hrs", note: "Consumo compute ultimi 30 giorni (Neon API), confrontato col limite del piano." },
      { id: "neon-storage", label: "Storage database", used: null, limit: null, unit: "GB", note: "Dimensione live del DB, confrontata col budget storage configurato." },
      { id: "neon-data-transfer-30d", label: "Data transfer (30 giorni)", used: null, limit: null, unit: "GB", note: "Traffico dati ultimi 30 giorni (Neon API), confrontato col limite del piano." },
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
    id: "cie",
    name: "CIE / OIDC (Login)",
    description: "Configurazione login OIDC/CIE (stato runtime).",
    metrics: [
      { id: "cie-config", label: "Configurazione", used: null, limit: 1, unit: "stato", note: "100% = issuer + client id/secret + redirect configurati. 0% = configurazione mancante." }
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
  return ["axiom-config", "firebase-config", "resend-config", "cie-config", "play-config"].includes(metricId);
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
  const [warningThreshold, setWarningThreshold] = useState(70);
  const [criticalThreshold, setCriticalThreshold] = useState(90);

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
    const cie = platformUsage?.platforms?.cie?.metrics;
    const play = platformUsage?.platforms?.play?.metrics;

    const mapped = BASE_PLATFORMS.map((platform) => ({
      ...platform,
      metrics: platform.metrics.map((metric) => {
        if (metric.id === "neon-compute-30d") {
          return {
            ...metric,
            used: secondsToCuHours(neon?.computeUnitSeconds30d),
            limit: secondsToCuHours(neonLimits?.computeUnitSecondsLimit30d),
            note:
              typeof neon?.computeUnitSeconds30d === "number"
                ? metric.note
                : "Dato non disponibile: verifica che la NEON_API_KEY abbia permessi per consumption history."
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
          return {
            ...metric,
            used: bytesToGb(neon?.dataTransferBytes30d),
            limit: bytesToGb(neonLimits?.dataTransferBudgetBytes),
            note:
              typeof neon?.dataTransferBytes30d === "number"
                ? metric.note
                : "Dato non disponibile: l'API Neon potrebbe non esporre data transfer con questa chiave/scope."
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
        if (metric.id === "cie-config") {
          const configured = Boolean(cie?.configured);
          return { ...metric, used: configured ? 1 : 0, limit: 1, unit: "", note: configured ? "Configurazione OK." : "Configurazione mancante: verifica OIDC_/CIE_ issuer, client id/secret, redirect." };
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
    if (percent >= criticalThreshold) return { label: "Critico", tone: "bg-red-100 text-red-700 border-red-300", icon: <AlertTriangle className="h-3.5 w-3.5" /> };
    if (percent >= warningThreshold) return { label: "Attenzione", tone: "bg-amber-100 text-amber-700 border-amber-300", icon: <Gauge className="h-3.5 w-3.5" /> };
    return { label: "OK", tone: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: <CheckCircle2 className="h-3.5 w-3.5" /> };
  };

  return (
    <div className="w-full mx-auto px-4 md:px-6 py-8 pt-20 min-h-screen bg-[radial-gradient(circle_at_top_left,_#ecfeff_0%,_#f7fbff_35%,_#ffffff_70%)]">
      <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white/85 p-5 md:p-6 shadow-sm backdrop-blur-sm">
        <Badge variant="outline" className="mb-3 text-cyan-700 border-cyan-300">Parametri Piani Free</Badge>
        <h1 className="text-3xl font-bold mb-2">Parametri</h1>
        <p className="text-slate-600 max-w-4xl">Qui trovi i limiti principali delle piattaforme free usate nell&apos;app, con barre di completamento per capire subito quanto margine resta.</p>
        <p className="text-xs text-slate-500 mt-2">Lista piattaforme ricavata da DPIA e configurazioni del progetto. Dove il provider non espone il consumo in-app, la voce e marcata come manuale.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-slate-700 border-slate-300">Ultimo aggiornamento: {lastUpdated}</Badge>
          <Badge variant="outline" className="text-slate-700 border-slate-300">Endpoint: /api/admin/monitoring/platform-usage</Badge>
          <Button variant="outline" size="sm" onClick={loadPlatformUsage} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Aggiorna adesso
          </Button>
        </div>
        {loadError && (
          <p className="mt-3 text-sm text-amber-700">
            {loadError}
          </p>
        )}
      </div>

      <Card className="border-slate-200/70 bg-white/90 shadow-sm mb-5">
        <CardHeader>
          <CardTitle className="text-base">Riepilogo completamento</CardTitle>
          <CardDescription>Barre rapide per capire “a che punto siamo” sulla configurazione e sull’uso risorse.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">Integrazioni configurate</p>
              <Badge variant="outline" className="text-slate-700 border-slate-300">
                {overview.configuredDone}/{overview.configuredTotal}
              </Badge>
            </div>
            <Progress value={overview.configuredPercent} className="h-2.5" />
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>{overview.configuredPercent}% completato</span>
              <span>{overview.configuredTotal ? "Obiettivo: 100%" : "N/D"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">Uso risorsa più alto</p>
              {typeof overview.highestUsage === "number" ? (
                <Badge variant="outline" className={`inline-flex items-center gap-1 ${getStatus(overview.highestUsage).tone}`}>
                  {getStatus(overview.highestUsage).icon}
                  {getStatus(overview.highestUsage).label}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-700 border-slate-300">N/D</Badge>
              )}
            </div>
            <Progress value={overview.highestUsage ?? 0} className={`h-2.5 ${overview.highestUsage === null ? "opacity-40" : ""}`} />
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>{overview.highestUsageLabel ?? "Nessuna metrica con quota disponibile"}</span>
              <span>{overview.highestUsage !== null ? `${overview.highestUsage}%` : "N/D"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/70 bg-white/90 shadow-sm mb-5">
        <CardHeader>
          <CardTitle className="text-base">Soglie alert configurabili</CardTitle>
          <CardDescription>Queste soglie si applicano solo alle metriche live con limite disponibile.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm"><span>Soglia Attenzione</span><span className="font-medium">{warningThreshold}%</span></div>
            <input type="range" min={40} max={95} value={warningThreshold} onChange={(e) => {
              const value = Number(e.target.value);
              setWarningThreshold(value);
              if (value >= criticalThreshold) setCriticalThreshold(Math.min(99, value + 1));
            }} className="w-full" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm"><span>Soglia Critico</span><span className="font-medium">{criticalThreshold}%</span></div>
            <input type="range" min={Math.max(50, warningThreshold + 1)} max={100} value={criticalThreshold} onChange={(e) => setCriticalThreshold(Number(e.target.value))} className="w-full" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/70 bg-white/90 shadow-sm mb-5">
        <CardHeader>
          <CardTitle className="text-base">Non disponibile con piano/API attuale</CardTitle>
          <CardDescription>
            Alcuni parametri non si possono leggere in modo affidabile dall'app con il piano free o senza API billing dedicate.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-1">
          <p>- Neon: percentuale/quota compute ufficiale del piano.</p>
          <p>- Neon: conteggio progetti account-level con chiavi scope limitato.</p>
          <p>- Render: usage/billing piano (non disponibile qui senza API billing dedicata).</p>
          <p>- Firebase/Resend/Axiom/Google Play: quote consumo piano non esposte in modo uniforme via API usata dall'app.</p>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {platforms.map((platform) => (
          <Card key={platform.id} className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle>{platform.name}</CardTitle>
              <CardDescription className="space-y-2">
                <span className="block">{platform.description}</span>
                <span className="block text-xs text-slate-500">
                  Aggiornato:{" "}
                  {formatUpdatedAt((platformUsage as any)?.platforms?.[platform.id]?.updatedAt)}
                </span>
              </CardDescription>
              {(() => {
                const risk = getPlatformRiskPercent(platform);
                if (risk === null) return null;
                const status = getStatus(risk);
                return (
                  <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-700">Rischio massimo piattaforma</p>
                      <Badge variant="outline" className={`inline-flex items-center gap-1 ${status.tone}`}>{status.icon}{status.label} · {risk}%</Badge>
                    </div>
                    <div className="mt-2">
                      <Progress value={risk} className="h-2.5" />
                    </div>
                  </div>
                );
              })()}
              {platform.id === "neon" && platformUsage?.diagnostics?.neon?.length ? (
                <p className="text-xs text-amber-700 mt-1">
                  Neon diagnostica: {platformUsage.diagnostics.neon.join(" | ")}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-5">
              {platform.metrics.map((metric) => {
                const percent = getPercent(metric.used, metric.limit);
                const progressEnabled = hasProgress(metric);
                const liveValueNoLimit = hasLiveValueWithoutLimit(metric);
                const isConfig = isConfiguredMetric(metric.id);
                const status = progressEnabled ? getStatus(percent) : { label: "Da configurare", tone: "bg-slate-100 text-slate-700 border-slate-300", icon: <Info className="h-3.5 w-3.5" /> };
                const finalStatus = liveValueNoLimit
                  ? { label: "Dato live", tone: "bg-blue-100 text-blue-700 border-blue-300", icon: <Info className="h-3.5 w-3.5" /> }
                  : isConfig
                    ? (metric.used === 1
                      ? { label: "Configurato", tone: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: <CheckCircle2 className="h-3.5 w-3.5" /> }
                      : { label: "Non configurato", tone: "bg-amber-100 text-amber-700 border-amber-300", icon: <AlertTriangle className="h-3.5 w-3.5" /> })
                    : status;
                return (
                  <div key={metric.id} className="space-y-2 rounded-xl border border-slate-200/60 bg-white/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{metric.label}</p>
                      <Badge variant="outline" className={`inline-flex items-center gap-1 ${finalStatus.tone}`}>{finalStatus.icon}{finalStatus.label}</Badge>
                    </div>
                    <Progress value={percent} className={`h-2.5 ${!progressEnabled ? "opacity-40" : ""}`} />
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
  );
};

export default Parametri;
