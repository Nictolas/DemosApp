import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, ArrowLeft, CheckCircle2, Gauge, Info, RefreshCw, XCircle } from "lucide-react";
import { CapacityEstimateCard } from "./CapacityEstimateCard";
import RiduzioneComputeGuide from "./RiduzioneComputeGuide";

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
    supabase?: string[];
  };
  sources?: Record<string, string>;
  platforms?: {
    supabase?: {
      updatedAt?: string;
      planTier?: string;
      metrics?: {
        databaseSizeBytes?: number | null;
        activeConnections?: number | null;
        registeredUsers?: number | null;
        fileStorageBytes?: number | null;
        egressBytes30d?: number | null;
        cachedEgressBytes30d?: number | null;
        computeRamBytes?: number | null;
      };
      limits?: {
        databaseStorageBudgetBytes?: number | null;
        activeConnectionsLimit?: number | null;
        egressBudgetBytes30d?: number | null;
        cachedEgressBudgetBytes30d?: number | null;
        fileStorageBudgetBytes?: number | null;
        registeredUsersLimit?: number | null;
        computeRamBudgetBytes?: number | null;
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
    upstash?: {
      updatedAt?: string;
      metrics?: { envConfigured?: boolean; pingOk?: boolean | null };
    };
    cloudflare?: {
      updatedAt?: string;
      metrics?: { edgeRequestDetected?: boolean };
    };
  };
};

const BASE_PLATFORMS: Platform[] = [
  {
    id: "supabase",
    name: "Supabase (Piano Free)",
    description:
      "Limiti del piano Free Supabase (Frankfurt). I budget hanno default nel backend; override con variabili SUPABASE_* su Render.",
    metrics: [
      {
        id: "supabase-storage",
        label: "Storage database",
        used: null,
        limit: null,
        unit: "GB",
        note: "Live da PostgreSQL. Limite piano Free: 500 MB."
      },
      {
        id: "supabase-active-connections",
        label: "Connessioni attive DB",
        used: null,
        limit: null,
        unit: "connessioni",
        note: "Live da pg_stat_activity. Limite piano Free: 60."
      },
      {
        id: "supabase-registered-users",
        label: "Utenti registrati (totale)",
        used: null,
        limit: null,
        unit: "utenti",
        note: "Proxy rispetto al limite MAU Supabase (50k): l'auth è custom, ma utile come cap."
      },
      {
        id: "supabase-file-storage",
        label: "File storage (bucket)",
        used: null,
        limit: null,
        unit: "GB",
        note: "Live da storage.objects se usi Supabase Storage. Limite Free: 1 GB."
      },
      {
        id: "supabase-egress-30d",
        label: "Egress (30 giorni)",
        used: null,
        limit: null,
        unit: "GB",
        note: "Limite Free: 5 GB/mese. Imposta SUPABASE_EGRESS_USED_BYTES_30D da Dashboard → Usage per la %."
      },
      {
        id: "supabase-cached-egress-30d",
        label: "Cached egress (30 giorni)",
        used: null,
        limit: null,
        unit: "GB",
        note: "Limite Free: 5 GB/mese. Imposta SUPABASE_CACHED_EGRESS_USED_BYTES_30D da Usage."
      },
      {
        id: "supabase-compute-ram",
        label: "RAM compute (Nano)",
        used: null,
        limit: null,
        unit: "MB",
        note: "Limite condiviso Free: 500 MB RAM. Imposta SUPABASE_COMPUTE_RAM_USED_BYTES dalla Overview (opzionale)."
      }
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
  },
  {
    id: "upstash",
    name: "Upstash Redis (cache)",
    description: "Cache applicativa per ridurre letture ripetute sul database (REST API, senza token in questa pagina).",
    metrics: [
      {
        id: "upstash-cache",
        label: "Operativa",
        used: null,
        limit: 1,
        unit: "stato",
        note: "100% = UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN su Render e PING REST riuscito."
      }
    ]
  },
  {
    id: "cloudflare",
    name: "Cloudflare (proxy / CDN)",
    description:
      "Indica se la richiesta che carica questa pagina ha raggiunto l'API passando dal proxy Cloudflare (header CF-Ray). Utile dopo aver puntato i nameserver.",
    metrics: [
      {
        id: "cloudflare-edge",
        label: "Proxy rilevato (richiesta corrente)",
        used: null,
        limit: 1,
        unit: "stato",
        note: "100% = header CF-Ray presente sull'API. Se usi l'URL diretto Render senza dominio proxied, può risultare 0% anche se Cloudflare è ok sul sito."
      }
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

function bytesToMb(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Number((value / 1024 / 1024).toFixed(2));
}

function isManualSupabaseMetric(metricId: string): boolean {
  return [
    "supabase-egress-30d",
    "supabase-cached-egress-30d",
    "supabase-compute-ram"
  ].includes(metricId);
}

function bytesToGb(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Number((value / 1024 / 1024 / 1024).toFixed(2));
}

function isConfiguredMetric(metricId: string): boolean {
  return ["axiom-config", "firebase-config", "resend-config", "play-config", "upstash-cache", "cloudflare-edge"].includes(metricId);
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

function formatUpdatedAt(value?: string): string {
  if (!value) return "N/D";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

const Parametri: React.FC = () => {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [platformUsage, setPlatformUsage] = useState<PlatformUsageApi | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const initialTab = (() => {
    if (typeof window === "undefined") return "utilizzo";
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab === "guida" ? "guida" : "utilizzo";
  })();
  const [activeTab, setActiveTab] = useState(initialTab);

  const onTabChange = (value: string) => {
    setActiveTab(value);
    const url = value === "guida" ? "/admin/parametri?tab=guida" : "/admin/parametri";
    window.history.replaceState(null, "", url);
  };

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
    const supabase = platformUsage?.platforms?.supabase?.metrics;
    const supabaseLimits = platformUsage?.platforms?.supabase?.limits;
    const render = platformUsage?.platforms?.render?.metrics;
    const axiom = platformUsage?.platforms?.axiom?.metrics;
    const firebase = platformUsage?.platforms?.firebase?.metrics;
    const resend = platformUsage?.platforms?.resend?.metrics;
    const play = platformUsage?.platforms?.play?.metrics;
    const upstash = platformUsage?.platforms?.upstash?.metrics;
    const cloudflare = platformUsage?.platforms?.cloudflare?.metrics;

    const mapped = BASE_PLATFORMS.map((platform) => ({
      ...platform,
      metrics: platform.metrics.map((metric) => {
        if (metric.id === "supabase-storage") {
          return {
            ...metric,
            used: bytesToGb(supabase?.databaseSizeBytes),
            limit: bytesToGb(supabaseLimits?.databaseStorageBudgetBytes)
          };
        }
        if (metric.id === "supabase-active-connections") {
          return {
            ...metric,
            used: supabase?.activeConnections ?? null,
            limit: supabaseLimits?.activeConnectionsLimit ?? null
          };
        }
        if (metric.id === "supabase-registered-users") {
          return {
            ...metric,
            used: supabase?.registeredUsers ?? null,
            limit: supabaseLimits?.registeredUsersLimit ?? null
          };
        }
        if (metric.id === "supabase-file-storage") {
          const used = supabase?.fileStorageBytes;
          return {
            ...metric,
            used: used != null ? bytesToGb(used) : null,
            limit: bytesToGb(supabaseLimits?.fileStorageBudgetBytes),
            note:
              used != null
                ? metric.note
                : "Nessun file in storage.objects oppure Storage non usato. Limite Free: 1 GB."
          };
        }
        if (metric.id === "supabase-egress-30d") {
          const used = supabase?.egressBytes30d;
          return {
            ...metric,
            used: used != null ? bytesToGb(used) : null,
            limit: bytesToGb(supabaseLimits?.egressBudgetBytes30d)
          };
        }
        if (metric.id === "supabase-cached-egress-30d") {
          const used = supabase?.cachedEgressBytes30d;
          return {
            ...metric,
            used: used != null ? bytesToGb(used) : null,
            limit: bytesToGb(supabaseLimits?.cachedEgressBudgetBytes30d)
          };
        }
        if (metric.id === "supabase-compute-ram") {
          const used = supabase?.computeRamBytes;
          return {
            ...metric,
            used: used != null ? bytesToMb(used) : null,
            limit: bytesToMb(supabaseLimits?.computeRamBudgetBytes)
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
        if (metric.id === "upstash-cache") {
          const env = Boolean(upstash?.envConfigured);
          const ping = upstash?.pingOk;
          if (!env) {
            return {
              ...metric,
              used: 0,
              limit: 1,
              unit: "",
              note: "Imposta UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN nelle variabili d'ambiente del backend."
            };
          }
          if (ping !== true) {
            return {
              ...metric,
              used: 0,
              limit: 1,
              unit: "",
              note: "Variabili presenti ma PING verso Upstash fallito o timeout: controlla token, rete o stato del database su console.upstash.com."
            };
          }
          return { ...metric, used: 1, limit: 1, unit: "", note: "Cache Redis raggiungibile dall'API (PING OK)." };
        }
        if (metric.id === "cloudflare-edge") {
          const ok = Boolean(cloudflare?.edgeRequestDetected);
          return {
            ...metric,
            used: ok ? 1 : 0,
            limit: 1,
            unit: "",
            note: ok
              ? "L'API ha ricevuto questa richiesta con header CF-Ray: il traffico verso l'endpoint admin è passato da Cloudflare."
              : "Nessun CF-Ray: il browser potrebbe chiamare l'API su un host non proxied (es. *.onrender.com) oppure i nameserver non sono ancora attivi. Verifica DNS e URL dell'API nel client."
          };
        }
        return metric;
      })
    }));

    return mapped.sort((a, b) => {
      const maxQuota = (p: Platform) => {
        const values = p.metrics.filter(hasProgress).map((m) => getPercent(m.used, m.limit));
        return values.length ? Math.max(...values) : -1;
      };
      return maxQuota(b) - maxQuota(a);
    });
  }, [platformUsage]);

  const lastUpdated = platformUsage?.generatedAt ? new Date(platformUsage.generatedAt).toLocaleString() : "N/D";

  const overview = useMemo(() => {
    const allMetrics = platforms.flatMap((p) => p.metrics);
    const configuredMetrics = allMetrics.filter((m) => isConfiguredMetric(m.id));
    const configuredDone = configuredMetrics.filter((m) => m.used === 1).length;
    const configuredTotal = configuredMetrics.length || 0;

    const progressMetrics = allMetrics.filter(hasProgress).filter((m) => !isConfiguredMetric(m.id));
    const atRisk = progressMetrics
      .map((m) => ({ metric: m, percent: getPercent(m.used, m.limit) }))
      .sort((a, b) => b.percent - a.percent)[0];

    return {
      configuredDone,
      configuredTotal,
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
    <div className="w-full min-h-screen bg-slate-50 pt-2 pb-4">
      <div className="w-full max-w-none mx-auto px-2 sm:px-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-700 -ml-1 h-7 text-xs"
            onClick={() => setLocation("/admin/ops-center")}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Ops Center
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
          <TabsList className="mb-2 h-8">
            <TabsTrigger value="utilizzo" className="text-xs px-3 h-7">
              Utilizzo
            </TabsTrigger>
            <TabsTrigger value="guida" className="text-xs px-3 h-7">
              Guida carico DB
            </TabsTrigger>
          </TabsList>

          <TabsContent value="utilizzo" className="mt-0 outline-none">
        <div className="mb-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-base font-bold text-slate-900">Parametri</h1>
          <Badge variant="outline" className="text-cyan-700 border-cyan-300 bg-cyan-50 text-[10px] px-1 py-0">Free</Badge>
          <span className="text-[11px] text-slate-500">
            &lt;{THRESHOLD_USAGE_WARN}% ok · {THRESHOLD_USAGE_WARN}–{THRESHOLD_USAGE_CRIT - 1}% attenzione · ≥{THRESHOLD_USAGE_CRIT}% critico
          </span>
          <span className="text-[11px] text-slate-400 hidden lg:inline">· {lastUpdated}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-slate-600 tabular-nums">
              Integrazioni {overview.configuredDone}/{overview.configuredTotal || "—"}
            </span>
            {typeof overview.highestUsage === "number" ? (
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getStatus(overview.highestUsage).tone}`}>
                {overview.highestUsageLabel}: {overview.highestUsage}%
              </Badge>
            ) : null}
            <Button variant="default" size="sm" className="bg-cyan-700 hover:bg-cyan-800 h-7 text-xs px-2" onClick={loadPlatformUsage} disabled={loading}>
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
              Aggiorna
            </Button>
          </div>
          {loadError && <p className="w-full text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">{loadError}</p>}
        </div>

        <CapacityEstimateCard
          liveRegisteredUsers={platformUsage?.platforms?.supabase?.metrics?.registeredUsers ?? null}
          liveStorageGb={bytesToGb(platformUsage?.platforms?.supabase?.metrics?.databaseSizeBytes)}
          freeLimits={{
            storageGb: bytesToGb(platformUsage?.platforms?.supabase?.limits?.databaseStorageBudgetBytes) ?? 0.5,
            egressGb: bytesToGb(platformUsage?.platforms?.supabase?.limits?.egressBudgetBytes30d) ?? 5,
            connections: platformUsage?.platforms?.supabase?.limits?.activeConnectionsLimit ?? 60,
            registeredUsers: platformUsage?.platforms?.supabase?.limits?.registeredUsersLimit ?? 50_000,
          }}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 items-start">
        {platforms.map((platform) => {
          const multi = platform.metrics.length > 2;
          return (
          <Card
            key={platform.id}
            className={`border-slate-200 bg-white shadow-none ${multi ? "col-span-2 sm:col-span-2 md:col-span-2 lg:col-span-3 xl:col-span-3" : ""}`}
          >
            <CardHeader className="py-1.5 px-2 space-y-0">
              <div className="flex items-center justify-between gap-1">
                <CardTitle className="text-xs leading-tight truncate">{platform.name}</CardTitle>
                {platform.id === "supabase" && platformUsage?.platforms?.supabase?.planTier ? (
                  <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-[9px] px-1 py-0 shrink-0">
                    {String(platformUsage.platforms.supabase.planTier).toUpperCase()}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent
              className={`pt-0 px-2 pb-1.5 ${multi ? "grid grid-cols-2 xl:grid-cols-3 gap-1" : "space-y-1"}`}
            >
              {platform.metrics.map((metric) => {
                const percent = getPercent(metric.used, metric.limit);
                const progressEnabled = hasProgress(metric);
                const liveValueNoLimit = hasLiveValueWithoutLimit(metric);
                const isConfig = isConfiguredMetric(metric.id);

                if (isConfig) {
                  const ok = metric.used === 1;
                  return (
                    <div key={metric.id} className="rounded border border-slate-100 bg-slate-50/80 px-1.5 py-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[11px] font-medium text-slate-900 truncate">{metric.label}</p>
                        {ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-label="OK" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-label="Mancante" />
                        )}
                      </div>
                    </div>
                  );
                }

                const status = progressEnabled ? getStatus(percent) : { label: "N/D", tone: "bg-slate-100 text-slate-700 border-slate-300", icon: <Info className="h-3 w-3" /> };
                const manualNoUsed =
                  platform.id === "supabase" &&
                  isManualSupabaseMetric(metric.id) &&
                  metric.used === null &&
                  metric.limit !== null &&
                  metric.limit > 0;
                const finalStatus = manualNoUsed
                  ? { label: "Limite", tone: "bg-slate-100 text-slate-700 border-slate-300", icon: <Info className="h-3 w-3" /> }
                  : liveValueNoLimit
                    ? { label: "Live", tone: "bg-blue-100 text-blue-700 border-blue-300", icon: <Info className="h-3 w-3" /> }
                    : status;
                const barTint = !progressEnabled ? undefined : usageQuotaBarClass(percent);
                return (
                  <div key={metric.id} className="rounded border border-slate-100 bg-slate-50/80 px-1.5 py-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-0.5">
                      <p className="text-[11px] font-medium text-slate-900 truncate">{metric.label}</p>
                      <Badge variant="outline" className={`inline-flex items-center gap-0.5 text-[9px] px-1 py-0 shrink-0 ${finalStatus.tone}`}>{finalStatus.label}</Badge>
                    </div>
                    {progressEnabled ? <Progress value={percent} className="h-1" indicatorClassName={barTint} /> : null}
                    <div className="flex items-center justify-between text-[10px] text-slate-600">
                      {progressEnabled ? (
                        <>
                          <span className="truncate">{`${metric.used}/${metric.limit}`}</span>
                          <span className="shrink-0">{percent}%</span>
                        </>
                      ) : liveValueNoLimit ? (
                        <span>{metric.used} {metric.unit}</span>
                      ) : manualNoUsed ? (
                        <span>Limite {metric.limit}</span>
                      ) : (
                        <span>N/D</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          );
        })}
        </div>
          </TabsContent>

          <TabsContent value="guida" className="mt-0 outline-none">
            <RiduzioneComputeGuide />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Parametri;
