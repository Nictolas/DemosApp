import React, { useEffect, useMemo, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { ArrowLeft, ChartPie, RefreshCw, RotateCcw, Timer, Activity, AlertTriangle } from "lucide-react";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type EndpointStat = {
  method: string;
  route: string;
  count: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
  minMs: number;
  errors: number;
};

type Snapshot = {
  since: string;
  uptimeSeconds: number;
  totalRequests: number;
  endpointsTracked: number;
  byCount: EndpointStat[];
  slowestByMaxMs: EndpointStat[];
};

const PIE_COLORS = ["#6366f1", "#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#64748b", "#ef4444"];

function formatDuration(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms)} ms`;
}

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function buildPieData(rows: EndpointStat[], valueKey: "count" | "totalMs") {
  const top = rows.slice(0, 6);
  const othersValue = rows.slice(6).reduce((sum, row) => sum + row[valueKey], 0);
  const mapped = top.map((row) => ({
    name: `${row.method} ${row.route}`,
    value: row[valueKey],
  }));

  if (othersValue > 0) {
    mapped.push({ name: "Altri endpoint", value: othersValue });
  }

  return mapped;
}

export default function MetricheEndpoint() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.ruolo === "AD" || user?.role === "AD";

  const loadSnapshot = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest("GET", "/admin/monitoring/request-endpoints");
      const payload = response?.data ?? response;

      if (payload?.success && payload?.data) {
        setSnapshot(payload.data);
        return;
      }

      throw new Error(payload?.error || "Risposta non valida");
    } catch (err: any) {
      setError(err?.message || "Errore caricamento metriche endpoint");
    } finally {
      setLoading(false);
    }
  };

  const resetSnapshot = async () => {
    try {
      setResetting(true);
      setError(null);
      await apiRequest("POST", "/admin/monitoring/request-endpoints/reset");
      await loadSnapshot();
    } catch (err: any) {
      setError(err?.message || "Errore reset metriche endpoint");
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      loadSnapshot();
    }
  }, [user, isAdmin]);

  const requestsPieData = useMemo(() => buildPieData(snapshot?.byCount ?? [], "count"), [snapshot]);
  const totalTimePieData = useMemo(() => {
    const rows = [...(snapshot?.byCount ?? [])].sort((a, b) => b.totalMs - a.totalMs);
    return buildPieData(rows, "totalMs");
  }, [snapshot]);

  if (isLoading) {
    return (
      <PageContainer className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (!isAdmin) {
    return (
      <PageContainer className="flex min-h-[60vh] items-center justify-center bg-slate-50">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Accesso negato</CardTitle>
            <CardDescription>Solo gli amministratori possono vedere queste metriche.</CardDescription>
          </CardHeader>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_#eef2ff_0%,_#f8fafc_45%,_#ffffff_100%)]">
      <div className="sticky top-0 z-10 w-full border-b border-indigo-100 bg-white/85 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[min(100%,100rem)] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <Button variant="ghost" size="sm" className="-ml-2 text-slate-700" onClick={() => setLocation("/admin/ops-center")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna a Ops Center
          </Button>
          <div className="hidden text-slate-300 sm:inline">|</div>
          <p className="text-sm text-slate-600">Vista semplice per capire quali endpoint pesano di piu.</p>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={loadSnapshot} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Aggiorna
            </Button>
            <Button size="sm" variant="destructive" onClick={resetSnapshot} disabled={resetting || loading}>
              <RotateCcw className={`mr-2 h-4 w-4 ${resetting ? "animate-spin" : ""}`} />
              Reset
            </Button>
          </div>
        </div>
      </div>

      <header className="w-full bg-gradient-to-br from-indigo-600 via-violet-600 to-slate-900 text-white">
        <div className="mx-auto w-full max-w-[min(100%,100rem)] px-4 py-12 sm:px-6 lg:px-10">
          <div className="max-w-4xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-indigo-100">
              <ChartPie className="h-3.5 w-3.5" />
              Fase 1: volume e tempi
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Metriche endpoint</h1>
            <p className="text-lg leading-relaxed text-indigo-100/95">
              Qui vedi quali API vengono chiamate piu spesso e quali consumano piu tempo lato server. Serve per
              decidere dove intervenire nella fase 2.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[min(100%,100rem)] space-y-8 px-4 py-8 sm:px-6 lg:px-10">
        {error && (
          <Alert className="border-red-200 bg-red-50 text-red-900">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Errore</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Richieste totali</CardDescription>
              <CardTitle className="text-3xl">{snapshot?.totalRequests ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Endpoint tracciati</CardDescription>
              <CardTitle className="text-3xl">{snapshot?.endpointsTracked ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Finestra attuale</CardDescription>
              <CardTitle className="text-3xl">{snapshot ? formatUptime(snapshot.uptimeSeconds) : "0m"}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Alert className="border-indigo-200 bg-indigo-50/80 text-indigo-950">
          <Activity className="h-4 w-4" />
          <AlertTitle>Come leggere questa pagina</AlertTitle>
          <AlertDescription>
            La torta di sinistra mostra chi riceve piu traffico. La torta di destra mostra dove il server spende piu
            tempo totale. Se un endpoint compare in alto in entrambe, e il primo candidato da ottimizzare.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Endpoint piu chiamati</CardTitle>
              <CardDescription>Top 6 per numero di richieste</CardDescription>
            </CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={requestsPieData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2}>
                    {requestsPieData.map((_, index) => (
                      <Cell key={`count-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} richieste`, "Volume"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Tempo server per endpoint</CardTitle>
              <CardDescription>Top 6 per tempo totale speso</CardDescription>
            </CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={totalTimePieData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2}>
                    {totalTimePieData.map((_, index) => (
                      <Cell key={`time-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatDuration(value), "Tempo totale"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChartPie className="h-5 w-5 text-indigo-600" />
                Classifica per traffico
              </CardTitle>
              <CardDescription>Quelli piu usati sono i migliori candidati per cache o riduzione query.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(snapshot?.byCount ?? []).slice(0, 10).map((row, index) => (
                <div key={`${row.method}-${row.route}`} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">#{index + 1}</Badge>
                    <Badge>{row.method}</Badge>
                    <span className="font-medium text-slate-900">{row.route}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span>{row.count} richieste</span>
                    <span>media {formatDuration(row.avgMs)}</span>
                    <span>max {formatDuration(row.maxMs)}</span>
                    <span>errori {row.errors}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-violet-600" />
                Endpoint da guardare per lentezza
              </CardTitle>
              <CardDescription>Qui vedi i picchi peggiori e il tempo totale accumulato.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(snapshot?.slowestByMaxMs ?? []).slice(0, 10).map((row, index) => (
                <div key={`${row.method}-${row.route}-slow`} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">#{index + 1}</Badge>
                    <Badge>{row.method}</Badge>
                    <span className="font-medium text-slate-900">{row.route}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span>picco {formatDuration(row.maxMs)}</span>
                    <span>media {formatDuration(row.avgMs)}</span>
                    <span>tempo totale {formatDuration(row.totalMs)}</span>
                    <span>richieste {row.count}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
