import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, useLocation } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Cpu, Database, Gauge, Server } from "lucide-react";

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 mt-6 first:mt-0">
      <Icon className="h-4 w-4 text-violet-600 shrink-0" />
      {children}
    </h3>
  );
}

export default function RiduzioneCompute() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  const isAdmin = user?.ruolo === "AD" || user?.role === "AD";

  if (isLoading) {
    return (
      <PageContainer className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (!isAdmin) {
    return (
      <PageContainer className="flex items-center justify-center bg-gradient-to-b from-slate-50 to-white min-h-[60vh]">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Accesso negato</CardTitle>
            <CardDescription>
              Solo gli amministratori possono consultare la checklist sul compute Neon.
            </CardDescription>
          </CardHeader>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-gradient-to-br from-slate-50 via-violet-50/30 to-white min-h-screen pb-12">
      <div className="w-full max-w-3xl mx-auto px-4 pt-4">
        <Button variant="ghost" className="mb-2 -ml-2 text-slate-700" onClick={() => setLocation("/gestisci")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna a Gestisci
        </Button>

        <Card className="shadow-lg border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white pb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur">
                <Cpu className="h-8 w-8" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-white">Riduzione compute</CardTitle>
                <CardDescription className="text-violet-100 mt-1">
                  Cosa possiamo fare per consumare meno CU-h su Neon e ridurre picchi apparenti sul grafico.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-1 text-sm text-slate-700 leading-relaxed">
            <p className="text-slate-600">
              Il consumo si misura in <strong>CU-h</strong> (ore di Compute Unit): più il database resta attivo e più
              lavora, più consumi. I &quot;blocchi&quot; da ~250–300 MB sul grafico RAM spesso sono il profilo minimo
              quando il compute è sveglio (es. 0.25 CU), non pacchi di dati separati.
            </p>

            <Separator className="my-6" />

            <SectionTitle icon={Server}>Backend — intervalli e query ripetute</SectionTitle>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <Badge variant="secondary" className="mr-2 align-middle">
                  Già previsto
                </Badge>
                <strong>PerformanceOptimizer:</strong> evitare <code className="text-xs bg-slate-100 px-1 rounded">COUNT</code> su{" "}
                <code className="text-xs bg-slate-100 px-1 rounded">users</code> ogni pochi secondi. Usare{" "}
                <code className="text-xs bg-slate-100 px-1 rounded">PERFORMANCE_OPTIMIZER_METRICS_INTERVAL_MS</code> (es.{" "}
                <code className="text-xs bg-slate-100 px-1 rounded">60000</code>) in produzione.
              </li>
              <li>
                <strong>PerformanceMonitor</strong> (tick periodico): ridurre frequenza se possibile, o non eseguire in
                ambienti dove non serve il monitoraggio continuo.
              </li>
              <li>
                <strong>Health check</strong> verso il DB: evitare polling troppo frequente da uptime o dashboard esterne.
              </li>
              <li>
                <strong>Job cron / <code className="text-xs bg-slate-100 px-1 rounded">ENABLE_*</code>:</strong> tenere
                disabilitati i job non essenziali per evitare burst periodici.
              </li>
            </ul>

            <SectionTitle icon={Database}>Neon — progetto e autoscale</SectionTitle>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                Controllare <strong>autoscale</strong> (es. min 0.25 ↔ max 2 CU): sotto carico Neon può allocare più CU;
                meno carico → meno salti verso l&apos;alto.
              </li>
              <li>
                Valutare quanto spesso il branch va in <strong>idle</strong>: più traffico e ping continui, più il compute
                resta sveglio.
              </li>
              <li>
                Consultare la documentazione Neon su compute e billing:{" "}
                <a
                  href="https://neon.com/docs/introduction/compute-lifecycle"
                  className="text-violet-700 underline underline-offset-2 hover:text-violet-900"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ciclo di vita del compute
                </a>
                .
              </li>
            </ul>

            <SectionTitle icon={Gauge}>Frontend e strumenti</SectionTitle>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                Evitare <strong>refresh automatici</strong> troppo aggressivi sulle pagine admin che chiamano API pesanti
                o metriche DB.
              </li>
              <li>
                Chiudere schede di <strong>monitoring</strong> quando non servono (ogni tab può tenere vivo traffico verso
                API e DB).
              </li>
            </ul>

            <SectionTitle icon={Cpu}>Diagnostica (quando serve capire un picco)</SectionTitle>
            <ol className="list-decimal pl-5 space-y-2 mt-2">
              <li>Annotare ora (UTC) di un picco dal dashboard Neon.</li>
              <li>
                Su Neon SQL Editor, classificare le query per frequenza o tempo (richiede{" "}
                <code className="text-xs bg-slate-100 px-1 rounded">pg_stat_statements</code>):
              </li>
            </ol>
            <pre className="mt-3 p-3 rounded-lg bg-slate-900 text-slate-100 text-xs overflow-x-auto">
              {`SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;`}
            </pre>
            <p className="text-slate-600 mt-2">
              Cercare pattern tipo <code className="text-xs bg-slate-100 px-1 rounded">COUNT(*)</code> su{" "}
              <code className="text-xs bg-slate-100 px-1 rounded">users</code>,{" "}
              <code className="text-xs bg-slate-100 px-1 rounded">pg_database_size</code>, letture da{" "}
              <code className="text-xs bg-slate-100 px-1 rounded">pg_stat_activity</code>.
            </p>

            <Separator className="my-6" />

            <h3 className="text-base font-semibold text-slate-900">Checklist operativa (da spuntare nel tempo)</h3>
            <ul className="mt-3 space-y-2 border border-slate-200 rounded-lg p-4 bg-white/80">
              <li className="flex gap-2">
                <span className="text-violet-600 font-mono text-xs pt-0.5">□</span>
                <span>Impostare <code className="text-xs bg-slate-100 px-1 rounded">PERFORMANCE_OPTIMIZER_METRICS_INTERVAL_MS</code> in produzione (≥ 60s).</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-600 font-mono text-xs pt-0.5">□</span>
                <span>Rivedere job abilitati e intervalli del performance monitor.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-600 font-mono text-xs pt-0.5">□</span>
                <span>Dopo un deploy, ricontrollare <code className="text-xs bg-slate-100 px-1 rounded">pg_stat_statements</code> per le query più chiamate.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-600 font-mono text-xs pt-0.5">□</span>
                <span>Dove serve: cache breve su endpoint admin pesanti; indici su query lente reali.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
