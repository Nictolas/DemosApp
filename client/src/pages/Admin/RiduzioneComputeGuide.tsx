import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  BookOpen,
  Cpu,
  Database,
  Gauge,
  HeartHandshake,
  Lightbulb,
  Server,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 text-xs font-mono whitespace-nowrap">
      {children}
    </kbd>
  );
}

/** Contenuto guida carico DB — usato come tab in Parametri */
export default function RiduzioneComputeGuide() {
  return (
    <div className="bg-[radial-gradient(ellipse_at_top,#eef2ff_0%,#f8fafc_45%,#ffffff_100%)] w-full rounded-lg overflow-hidden border border-violet-100">
      <header className="w-full bg-linear-to-br from-violet-600 via-indigo-600 to-slate-900 text-white">
        <div className="w-full max-w-[min(100%,100rem)] mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-violet-100">
                <Sparkles className="h-3.5 w-3.5" />
                Meno sprechi, stesso servizio
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
                Riduzione carico database
              </h2>
              <p className="text-base sm:text-lg text-violet-100/95 leading-relaxed">
                Qui trovi spiegato <strong className="text-white">cosa consuma risorse su Supabase</strong> e{" "}
                <strong className="text-white">cosa possiamo fare in pratica</strong> per restare dentro i limiti del
                piano free — anche se parti da zero.
              </p>
            </div>
            <div className="shrink-0 flex justify-start lg:justify-end">
              <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 sm:p-5 max-w-md">
                <p className="text-sm text-violet-100 leading-relaxed">
                  <strong className="text-white">In una frase:</strong> il database è come un ufficio con un numero
                  limitato di sportelli (connessioni). Se bussano ogni pochi secondi per chiedere &quot;quanti fogli ci
                  sono?&quot;, gli sportelli restano occupati e il servizio rallenta o va in errore.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full max-w-[min(100%,100rem)] mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10 space-y-12">
        <section aria-labelledby="concetti-base">
          <h2 id="concetti-base" className="sr-only">
            Concetti base
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            <Card className="border-violet-100 shadow-md hover:shadow-lg transition-shadow bg-white/90">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-violet-700 font-semibold">
                  <Database className="h-5 w-5" />
                  Cos&apos;è Supabase (semplice)
                </div>
                <CardDescription className="text-slate-600 text-base leading-relaxed pt-2">
                  Supabase è il <strong>luogo in cloud dove vive il database</strong> PostgreSQL dell&apos;app: utenti,
                  voti, notifiche, ecc. Non è il sito web nel browser: è il &quot;magazzino dati&quot; dietro le quinte.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-violet-100 shadow-md hover:shadow-lg transition-shadow bg-white/90">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-violet-700 font-semibold">
                  <Timer className="h-5 w-5" />
                  Connessioni e pooler
                </div>
                <CardDescription className="text-slate-600 text-base leading-relaxed pt-2">
                  L&apos;API su Render parla con Supabase tramite <strong>Supavisor</strong> (pooler, porta 6543). Ogni
                  richiesta che tocca il DB usa una <strong>connessione</strong>. Sul piano free il numero di connessioni
                  simultanee è limitato — vedi anche <Kbd>DATABASE_POOL_MAX</Kbd> su Render.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-violet-100 shadow-md hover:shadow-lg transition-shadow bg-white/90">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-violet-700 font-semibold">
                  <Gauge className="h-5 w-5" />
                  Cosa controllare
                </div>
                <CardDescription className="text-slate-600 text-base leading-relaxed pt-2">
                  Nella tab <strong>Utilizzo</strong> di questa pagina vedi storage e connessioni attive. I limiti del
                  piano si configurano con <Kbd>SUPABASE_DB_STORAGE_BUDGET_BYTES</Kbd> e{" "}
                  <Kbd>SUPABASE_ACTIVE_CONNECTIONS_LIMIT</Kbd>.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <Alert className="border-amber-200 bg-amber-50/90 text-amber-950 max-w-4xl">
          <Lightbulb className="h-5 w-5 text-amber-700" />
          <AlertTitle className="text-amber-900">Supabase non ha le &quot;CU-h&quot; di Neon</AlertTitle>
          <AlertDescription className="text-amber-900/90 text-base leading-relaxed">
            <p>
              Con Supabase non si misura il compute in CU-h come su Neon. I rischi principali sul piano free sono{" "}
              <strong>troppe query</strong>, <strong>troppe connessioni</strong> e <strong>storage pieno</strong>.
              Ridurre le domande inutili al database resta la leva più efficace.
            </p>
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:gap-12 items-start">
          <Card className="border-slate-200/80 shadow-xs overflow-hidden">
            <CardHeader className="bg-linear-to-r from-slate-50 to-violet-50/50 border-b">
              <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                <BookOpen className="h-5 w-5 text-violet-600" />
                Analogia: gli sportelli del database
              </CardTitle>
              <CardDescription className="text-slate-600 text-base leading-relaxed">
                Ti aiuta a collegare &quot;monitoraggio&quot; e &quot;limiti del piano&quot;.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 text-slate-700 text-base leading-relaxed">
              <p>
                <strong>1.</strong> Ogni richiesta API che legge o scrive dati occupa uno &quot;sportello&quot;
                (connessione) verso PostgreSQL.
              </p>
              <p>
                <strong>2.</strong> Se il backend fa controlli automatici ogni pochi secondi (&quot;quanti utenti
                attivi?&quot;), gli sportelli restano occupati anche senza utenti reali sul sito.
              </p>
              <p>
                <strong>3.</strong> Con Supavisor e <Kbd>DATABASE_POOL_MAX</Kbd> limiti quante connessioni apre
                l&apos;app; se superi il limite del progetto Supabase, le richieste possono fallire con errori di pool.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs overflow-hidden">
            <CardHeader className="bg-linear-to-r from-slate-50 to-indigo-50/50 border-b">
              <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                <Zap className="h-5 w-5 text-indigo-600" />
                Cosa ci fa spendere / saturare di più
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <ul className="space-y-4 text-slate-700 text-base leading-relaxed">
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800 text-sm font-bold">
                    A
                  </span>
                  <span>
                    <strong>Query ripetute:</strong> anche domande leggere, se in loop ogni 10–30 secondi, sommano
                    migliaia di letture al giorno.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800 text-sm font-bold">
                    B
                  </span>
                  <span>
                    <strong>Connessioni:</strong> pool troppo alto su Render + traffico concorrente → rischio di
                    saturare il limite Supabase.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800 text-sm font-bold">
                    C
                  </span>
                  <span>
                    <strong>Storage:</strong> tabelle storiche o log nel DB che crescono senza export/pulizia.
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Separator className="max-w-4xl" />

        <section aria-labelledby="azioni">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h2 id="azioni" className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Cosa possiamo fare noi (app e operazioni)
              </h2>
              <p className="mt-2 text-slate-600 text-base sm:text-lg max-w-3xl leading-relaxed">
                Leve che controlliamo nel codice e su Render.
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-violet-300 text-violet-800 bg-violet-50">
              Priorità: meno domande inutili al DB
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-violet-100/80 bg-white shadow-xs">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-violet-100 p-2.5">
                    <Server className="h-6 w-6 text-violet-700" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-900">Backend (Render)</CardTitle>
                    <CardDescription className="text-slate-600 mt-1 text-base leading-relaxed">
                      Intervalli metriche, job e pool connessioni.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-slate-700 text-base leading-relaxed border-t bg-slate-50/50 pt-5">
                <p>
                  <strong>Metriche:</strong> <Kbd>PERFORMANCE_OPTIMIZER_METRICS_INTERVAL_MS</Kbd> ≥{" "}
                  <Kbd>60000</Kbd> (60 s) in produzione.
                </p>
                <p>
                  <strong>Pool:</strong> <Kbd>DATABASE_POOL_MAX</Kbd> 10–20 sul piano free; URI pooler con{" "}
                  <Kbd>pgbouncer=true</Kbd>.
                </p>
                <p>
                  <strong>Job:</strong> disattiva sync non necessari; evita che partano tutti insieme dopo un deploy.
                </p>
                <p>
                  <strong>Log:</strong> con <Kbd>AXIOM_ENABLED=true</Kbd> i log non finiscono nel DB (meno storage e
                  meno scritture).
                </p>
              </CardContent>
            </Card>

            <Card className="border-indigo-100/80 bg-white shadow-xs">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-indigo-100 p-2.5">
                    <Database className="h-6 w-6 text-indigo-700" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-900">Dashboard Supabase</CardTitle>
                    <CardDescription className="text-slate-600 mt-1 text-base leading-relaxed">
                      Usage, connessioni e storage dal pannello cloud.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-slate-700 text-base leading-relaxed border-t bg-slate-50/50 pt-5">
                <p>
                  In <strong>Project Settings → Database</strong> controlla connessioni attive e dimensione progetto.
                </p>
                <p>
                  Documentazione:{" "}
                  <a
                    href="https://supabase.com/docs/guides/platform/org-usage"
                    className="text-indigo-700 font-medium underline underline-offset-2 hover:text-indigo-900"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Usage e limiti Supabase
                  </a>
                  .
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-100/80 bg-white shadow-xs">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-100 p-2.5">
                    <Cpu className="h-6 w-6 text-emerald-800" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-900">Schermate admin e browser</CardTitle>
                    <CardDescription className="text-slate-600 mt-1 text-base leading-relaxed">
                      Pagine con refresh automatico → più chiamate API → più query DB.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-slate-700 text-base leading-relaxed border-t bg-slate-50/50 pt-5">
                <p>
                  Chiudi le schede di monitoraggio quando non servono; evita intervalli di refresh troppo bassi.
                </p>
              </CardContent>
            </Card>

            <Card className="border-sky-100/80 bg-white shadow-xs">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-sky-100 p-2.5">
                    <HeartHandshake className="h-6 w-6 text-sky-800" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-900">Query più frequenti</CardTitle>
                    <CardDescription className="text-slate-600 mt-1 text-base leading-relaxed">
                      Nel SQL Editor Supabase, con <Kbd>pg_stat_statements</Kbd> attivo:
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-slate-700 text-base leading-relaxed border-t bg-slate-50/50 pt-5">
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs sm:text-sm overflow-x-auto leading-relaxed">
                  {`SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;`}
                </pre>
                <p className="text-slate-600 text-sm">
                  Cerca conteggi su <Kbd>users</Kbd>, <Kbd>pg_database_size</Kbd> o sessioni attive: spesso sono
                  monitoraggio ripetuto.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section aria-labelledby="checklist">
          <h2 id="checklist" className="text-2xl font-bold text-slate-900 mb-4">
            Checklist
          </h2>
          <Card className="border-violet-200 bg-linear-to-br from-white to-violet-50/40 shadow-md">
            <CardContent className="pt-6 pb-6">
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-800 text-base leading-relaxed">
                <li className="flex gap-3 items-start rounded-lg bg-white/80 p-4 border border-violet-100">
                  <span className="text-violet-500 font-mono text-lg leading-none">□</span>
                  <span>
                    <Kbd>DATABASE_URL</Kbd> = pooler Supabase (6543) + <Kbd>pgbouncer=true</Kbd>;{" "}
                    <Kbd>DATABASE_POOL_MAX</Kbd> ≤ 20.
                  </span>
                </li>
                <li className="flex gap-3 items-start rounded-lg bg-white/80 p-4 border border-violet-100">
                  <span className="text-violet-500 font-mono text-lg leading-none">□</span>
                  <span>
                    <Kbd>SUPABASE_DB_STORAGE_BUDGET_BYTES</Kbd> e <Kbd>SUPABASE_ACTIVE_CONNECTIONS_LIMIT</Kbd> su Render.
                  </span>
                </li>
                <li className="flex gap-3 items-start rounded-lg bg-white/80 p-4 border border-violet-100">
                  <span className="text-violet-500 font-mono text-lg leading-none">□</span>
                  <span>Metriche e job con intervalli ragionevoli; nessun loop ogni pochi secondi.</span>
                </li>
                <li className="flex gap-3 items-start rounded-lg bg-white/80 p-4 border border-violet-100">
                  <span className="text-violet-500 font-mono text-lg leading-none">□</span>
                  <span>Cache Upstash attiva; export dati storici se lo storage cresce.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>

        <footer className="text-center text-sm text-slate-500 pb-6">
          Guida interna: aggiornala quando cambiano intervalli, job o il piano Supabase.
        </footer>
      </div>
    </div>
  );
}
