import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import apiRequest from "@/lib/api-request";
import { Shield, Activity, Scale, Database, HardDrive, Bell, ArrowRight, SlidersHorizontal, PieChart, Gauge, ChevronDown, ShieldCheck, RefreshCw } from "lucide-react";

type SystemHealth = {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "CRITICAL";
  timestamp?: string;
  summary?: { total: number; passed: number; failed: number; warnings: number };
  checks?: Record<string, { status: string; message?: string }>;
};

type LiveSecurityStatus = {
  health: SystemHealth | null;
  performanceMonitoring: boolean | null;
  violationMonitoring: boolean | null;
  lastCheckedAt: string | null;
};

const statusLabel = (status: SystemHealth["status"] | undefined): string => {
  switch (status) {
    case "HEALTHY": return "Controlli regolari";
    case "DEGRADED": return "Attenzione";
    case "UNHEALTHY":
    case "CRITICAL": return "Problemi rilevati";
    default: return "Non verificabile";
  }
};

const monitoringLabel = (value: boolean | null) =>
  value === null ? "non verificabile" : value ? "attivo" : "disattivato";

const OpsCenter: React.FC = () => {
  const [, setLocation] = useLocation();
  const [securityStatus, setSecurityStatus] = useState<LiveSecurityStatus>({
    health: null,
    performanceMonitoring: null,
    violationMonitoring: null,
    lastCheckedAt: null,
  });
  const [securityLoading, setSecurityLoading] = useState(true);
  const [securityRefresh, setSecurityRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      setSecurityLoading(true);
      // These are existing Admin-only endpoints. No AI service, new worker or
      // automatic incident action is started by opening the dashboard.
      const results = await Promise.allSettled([
        apiRequest.get<SystemHealth>("/admin/monitoring/health"),
        apiRequest.get<{ isMonitoring: boolean }>("/admin/monitoring/status"),
        apiRequest.get<{ status: { isRunning: boolean } }>("/admin/violations/monitoring/status"),
      ]);
      if (cancelled) return;
      const healthResult = results[0].status === "fulfilled" ? results[0].value : null;
      const performanceResult = results[1].status === "fulfilled" ? results[1].value : null;
      const violationsResult = results[2].status === "fulfilled" ? results[2].value : null;
      const health = healthResult?.success === true &&
        healthResult.data?.checks && healthResult.data?.summary &&
        typeof healthResult.data?.status === "string"
        ? healthResult.data : null;
      const performanceMonitoring = performanceResult?.success === true &&
        typeof performanceResult.data?.isMonitoring === "boolean"
        ? performanceResult.data.isMonitoring : null;
      const violationMonitoring = violationsResult?.success === true &&
        typeof violationsResult.data?.status?.isRunning === "boolean"
        ? violationsResult.data.status.isRunning : null;
      setSecurityStatus({
        health,
        performanceMonitoring,
        violationMonitoring,
        lastCheckedAt: health ? health.timestamp || new Date().toISOString() : null,
      });
      setSecurityLoading(false);
    };
    void loadStatus();
    return () => { cancelled = true; };
  }, [securityRefresh]);

  return (
    <div className="admin-ops-page w-full mx-auto max-w-6xl px-4 py-5 pb-12 md:px-6 bg-[radial-gradient(circle_at_top_left,_#eef4ff_0%,_#f6f9ff_36%,_#ffffff_72%)]">
      <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white/85 p-5 md:p-6 shadow-sm backdrop-blur-sm">
        <Badge variant="outline" className="mb-3 text-indigo-700 border-indigo-300">Admin Hub</Badge>
        <h1 className="text-3xl font-bold mb-2">Ops Center</h1>
        <p className="text-slate-600 max-w-4xl">
          Quattro gruppi espandibili. Apri soltanto quello che ti interessa; le operazioni tecniche restano riservate all'Admin.
        </p>
      </div>


      <details open className="group mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">
          <span className="min-w-0">
            <span className="block text-base">Salute</span>
            <span className="mt-1 block text-xs font-normal text-slate-600">Stato servizi, Neon, spazio, parametri e metriche API.</span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-indigo-600 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-3 md:grid-cols-2 xl:grid-cols-3">
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Monitoraggio Sistema</CardTitle>
              <CardDescription>Ti mostra se il sistema sta funzionando bene oppure no.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant="outline">Operativita</Badge>
              <p className="text-sm text-slate-600">
                Cosa puoi farci: vedere subito problemi di salute/performance e capire quando intervenire.
              </p>
              <Button className="w-full justify-between" onClick={() => setLocation("/monitoring-dashboard/overview")}>
                Apri Panoramica <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Database (Neon)</CardTitle>
              <CardDescription>Ti aiuta a capire se il database e sotto stress o sta rallentando.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Cosa puoi farci: controllare connessioni, dimensioni e query lente per prevenire blocchi.
              </p>
              <Button className="w-full justify-between" onClick={() => setLocation("/monitoring-dashboard/database")}>
                Apri Dettaglio DB <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Spazio Disco App</CardTitle>
              <CardDescription>Ti dice quanto spazio sta usando il server dell'applicazione.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Cosa puoi farci: trovare le cartelle piu pesanti e capire dove liberare spazio.
              </p>
              <Button className="w-full justify-between" onClick={() => setLocation("/monitoring-dashboard/disk")}>
                Apri Breakdown Disco <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" /> Parametri e carico DB</CardTitle>
              <CardDescription>Limiti piani free (live) e guida per ridurre query e connessioni.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-slate-600">
                Una sola pagina con due tab: utilizzo risorse e checklist operativa.
              </p>
              <Button className="w-full justify-between" onClick={() => setLocation("/admin/parametri")}>
                Tab Utilizzo <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="w-full justify-between" onClick={() => setLocation("/admin/parametri?tab=guida")}>
                Tab Guida carico DB <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" /> Metriche endpoint</CardTitle>
              <CardDescription>Classifica delle API piu chiamate e piu lente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Cosa puoi farci: individuare endpoint pesanti e capire dove ottimizzare o ridurre il traffico.
              </p>
              <Button className="w-full justify-between" onClick={() => setLocation("/gestisci/metriche-endpoint")}>
                Apri metriche API <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </details>
      <details className="group mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">
          <span className="min-w-0">
            <span className="block text-base">Sicurezza</span>
            <span className="mt-1 block text-xs font-normal text-slate-600">Security Center, log, avvisi e protezione delle API.</span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-indigo-600 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-3 md:grid-cols-2 xl:grid-cols-3">
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Stato della sicurezza</CardTitle>
              <CardDescription>Controlli reali del backend DEMOS. Nessun agente AI autonomo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div role="status" aria-live="polite" className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Salute: {securityLoading ? "verifica in corso" : statusLabel(securityStatus.health?.status)}
                </Badge>
                <Badge variant="outline">
                  Prestazioni: {securityLoading ? "verifica in corso" : monitoringLabel(securityStatus.performanceMonitoring)}
                </Badge>
                <Badge variant="outline">
                  Rilevamento violazioni: {securityLoading ? "verifica in corso" : monitoringLabel(securityStatus.violationMonitoring)}
                </Badge>
              </div>
              {securityStatus.health?.summary && (
                <p className="text-sm text-slate-600">
                  Verifiche superate: {securityStatus.health.summary.passed}/{securityStatus.health.summary.total}.
                  {securityStatus.health.summary.failed > 0 ? ` Errori: ${securityStatus.health.summary.failed}.` : ""}
                  {securityStatus.health.summary.warnings > 0 ? ` Avvisi: ${securityStatus.health.summary.warnings}.` : ""}
                </p>
              )}
              <p className="text-xs leading-relaxed text-slate-600">
                Ultimo controllo della salute: {securityStatus.lastCheckedAt
                  ? new Date(securityStatus.lastCheckedAt).toLocaleString("it-IT")
                  : "non disponibile"}.
                I dati non attestano l'assenza di attacchi. Se un monitor risulta disattivato,
                non viene avviato automaticamente da questa schermata.
              </p>
              <p className="text-xs leading-relaxed text-slate-500">
                Per analizzare anomalie con ChatGPT, consulta i log ed evita di inviare
                credenziali o dati personali non necessari. Nessun log viene trasmesso automaticamente.
              </p>
              <Button variant="outline" className="w-full justify-between" disabled={securityLoading}
                onClick={() => setSecurityRefresh(value => value + 1)}>
                <span>Aggiorna stato</span><RefreshCw className="h-4 w-4" />
              </Button>
              <Button className="w-full justify-between" onClick={() => setLocation("/monitoring-dashboard/overview")}>
                Apri monitoraggio <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Alert e Log</CardTitle>
              <CardDescription>Mostra messaggi e avvisi del sistema quando qualcosa non va.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Cosa puoi farci: cercare errori recenti, capire la causa di un problema e seguirne l'evoluzione.
              </p>
              <Button className="w-full justify-between" onClick={() => setLocation("/logging-dashboard")}>
                Apri Logging <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5" /> Rate Limiting</CardTitle>
              <CardDescription>Controlla i limiti di richieste per proteggere API e login.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Cosa puoi farci: vedere soglie e comportamenti del rate limiting quando il traffico e anomalo.
              </p>
              <Button className="w-full justify-between" onClick={() => setLocation("/rate-limiting-dashboard")}>
                Apri Rate Limiting <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </details>
      <details className="group mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">
          <span className="min-w-0">
            <span className="block text-base">Privacy</span>
            <span className="mt-1 block text-xs font-normal text-slate-600">GDPR, richieste e documenti legali: funzioni operative Admin.</span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-indigo-600 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-3 md:grid-cols-2 xl:grid-cols-3">
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> GDPR e Legale</CardTitle>
              <CardDescription>Raccoglie strumenti per rispettare GDPR e obblighi legali.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Cosa puoi farci: gestire richieste privacy, documenti legali e controlli di conformita.
              </p>
              <Button className="w-full justify-between" onClick={() => setLocation("/admin/gdpr-legal")}>
                Apri Gestione GDPR <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </details>
      <details className="group mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">
          <span className="min-w-0">
            <span className="block text-base">Backup/Export</span>
            <span className="mt-1 block text-xs font-normal text-slate-600">Stato del backup applicativo ritirato ed esportazione dati.</span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-indigo-600 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-3 md:grid-cols-2 xl:grid-cols-3">
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Backup e Export</CardTitle>
              <CardDescription>Ti permette di mettere al sicuro i dati e scaricarli quando serve.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-slate-600">
                Cosa puoi farci: verificare lo stato del sistema di backup dismesso ed esportare dati per analisi; l'export non sostituisce un backup completo.
              </p>
              <Button variant="outline" className="w-full justify-between" onClick={() => setLocation("/backup-dashboard")}>
                Stato backup legacy <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="w-full justify-between" onClick={() => setLocation("/admin/data-export")}>
                Data Export <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </details>
    </div>
  );
};

export default OpsCenter;
