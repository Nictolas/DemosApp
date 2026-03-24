import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, useLocation } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  BookOpen,
  Cpu,
  Database,
  Gauge,
  HeartHandshake,
  Lightbulb,
  Moon,
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
              Solo gli amministratori possono consultare questa guida.
            </CardDescription>
          </CardHeader>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-[radial-gradient(ellipse_at_top,_#eef2ff_0%,_#f8fafc_45%,_#ffffff_100%)] min-h-screen w-full">
      {/* Barra superiore: tutta larghezza */}
      <div className="w-full border-b border-violet-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full max-w-[min(100%,100rem)] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-700 -ml-2 shrink-0"
            onClick={() => setLocation("/gestisci")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna a Gestisci
          </Button>
          <span className="hidden sm:inline text-slate-300">|</span>
          <p className="text-sm text-slate-600">
            Guida per chi non è esperto di database o di hosting
          </p>
        </div>
      </div>

      {/* Hero a tutta larghezza */}
      <header className="w-full bg-gradient-to-br from-violet-600 via-indigo-600 to-slate-900 text-white">
        <div className="w-full max-w-[min(100%,100rem)] mx-auto px-4 sm:px-6 lg:px-10 py-12 sm:py-16 lg:py-20">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-violet-100">
                <Sparkles className="h-3.5 w-3.5" />
                Meno sprechi, stesso servizio
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
                Riduzione compute
              </h1>
              <p className="text-lg sm:text-xl text-violet-100/95 leading-relaxed">
                Qui trovi spiegato <strong className="text-white">cosa succede sul grafico</strong>, cosa significa
                &quot;consumare compute&quot; e <strong className="text-white">cosa possiamo fare in pratica</strong>{" "}
                per non bruciare il budget del database Neon — anche se parti da zero.
              </p>
            </div>
            <div className="shrink-0 flex justify-start lg:justify-end">
              <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 sm:p-6 max-w-md">
                <p className="text-sm text-violet-100 leading-relaxed">
                  <strong className="text-white">In una frase:</strong> il database è come un ufficio. Se bussano alla
                  porta ogni pochi secondi per chiedere &quot;quanti fogli ci sono?&quot;, l&apos;ufficio resta sveglio e
                  lavora di più. Meno visite inutili, meno fatica (e meno consumo).
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Corpo: larghezza piena con contenitore largo */}
      <div className="w-full max-w-[min(100%,100rem)] mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-14 space-y-14 sm:space-y-16">
        {/* Tre colonne: concetti base */}
        <section aria-labelledby="concetti-base">
          <h2 id="concetti-base" className="sr-only">
            Concetti base
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            <Card className="border-violet-100 shadow-md hover:shadow-lg transition-shadow bg-white/90">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-violet-700 font-semibold">
                  <Database className="h-5 w-5" />
                  Cos&apos;è Neon (semplice)
                </div>
                <CardDescription className="text-slate-600 text-base leading-relaxed pt-2">
                  Neon è il <strong>luogo in cloud dove vive il database</strong> PostgreSQL dell&apos;app: lì sono
                  salvati utenti, voti, notifiche, ecc. Non è il sito web che vedi nel browser: è il &quot;magazzino
                  dati&quot; dietro le quinte.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-violet-100 shadow-md hover:shadow-lg transition-shadow bg-white/90">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-violet-700 font-semibold">
                  <Timer className="h-5 w-5" />
                  Cos&apos;è il compute (e le CU-h)
                </div>
                <CardDescription className="text-slate-600 text-base leading-relaxed pt-2">
                  <strong>Compute</strong> = il &quot;motore&quot; che fa girare quel database quando è acceso. Neon
                  misura l&apos;uso in <strong>CU-h</strong>: pensa alle <strong>ore in cui il motore è acceso e lavora</strong>.
                  Più resta acceso e più chiede lavoro, più consumi dal pacchetto mensile (come le ore di telefonia).
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-violet-100 shadow-md hover:shadow-lg transition-shadow bg-white/90">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-violet-700 font-semibold">
                  <Gauge className="h-5 w-5" />
                  Cosa mostra il grafico
                </div>
                <CardDescription className="text-slate-600 text-base leading-relaxed pt-2">
                  Il grafico non è una lista di &quot;pacchi da scaricare&quot;. Mostra soprattutto{" "}
                  <strong>quanta memoria (RAM)</strong> usa Postgres mentre è attivo e{" "}
                  <strong>quanta potenza (CU)</strong> gli viene assegnata. Quando il servizio è al minimo, la RAM può
                  sembrare sempre &quot;un blocco&quot; simile: è normale.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <Alert className="border-amber-200 bg-amber-50/90 text-amber-950 max-w-4xl">
          <Lightbulb className="h-5 w-5 text-amber-700" />
          <AlertTitle className="text-amber-900">Perché vedo salti da circa 250–300 MB?</AlertTitle>
          <AlertDescription className="text-amber-900/90 text-base leading-relaxed">
            <p>
              Sul piano con autoscale minimo (spesso <strong>0.25 CU</strong>), PostgreSQL ha comunque bisogno di una
              &quot;scatola&quot; di memoria per funzionare — come un piccolo ufficio con una scrivania minima. Quindi
              sul grafico la RAM non parte da zero: quando il compute è sveglio, vedi un livello di base che può
              sembrare un <strong>blocco fisso</strong>. Non significa che arrivino 300 MB di dati a ondate dal nulla;
              significa che il motore è acceso e usa la sua memoria di base.
            </p>
          </AlertDescription>
        </Alert>

        {/* Due colonne: analogia + impatto */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:gap-12 items-start">
          <Card className="border-slate-200/80 shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-violet-50/50 border-b">
              <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                <BookOpen className="h-5 w-5 text-violet-600" />
                Analogia: la lampadina del database
              </CardTitle>
              <CardDescription className="text-slate-600 text-base leading-relaxed">
                Ti aiuta a collegare &quot;grafico&quot; e &quot;fattura&quot;.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 text-slate-700 text-base leading-relaxed">
              <p>
                <strong>1.</strong> Se nessuno usa il database da un po&apos;, Neon può mettere il compute in stato{" "}
                <strong>idle</strong> (come spegnere la lampadina per risparmiare — vedi{" "}
                <a
                  href="https://neon.com/docs/introduction/compute-lifecycle"
                  className="text-violet-700 font-medium underline underline-offset-2 hover:text-violet-900"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ciclo di vita del compute su Neon
                </a>
                ).
              </p>
              <p>
                <strong>2.</strong> Appena qualcuno (un utente, un monitoraggio, un cron) fa una richiesta, la lampadina si
                riaccende: il compute torna <strong>active</strong>.
              </p>
              <p>
                <strong>3.</strong> Se qualcosa nel codice <strong>chiede dati al database ogni pochi secondi</strong>,
                la lampadina resta accesa quasi sempre — anche se le domande sono piccole. È così che si consumano le
                CU-h senza accorgersene.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b">
              <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                <Zap className="h-5 w-5 text-indigo-600" />
                Cosa ci fa spendere di più (in parole povere)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <ul className="space-y-4 text-slate-700 text-base leading-relaxed">
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800 text-sm font-bold">
                    A
                  </span>
                  <span>
                    <strong>Tempo acceso:</strong> più il compute resta attivo, più ore consumi. Non è &quot;un colpo da
                    300 MB&quot; che costa: è soprattutto <strong>quanto dura</strong> l&apos;attività nel mese.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800 text-sm font-bold">
                    B
                  </span>
                  <span>
                    <strong>Carico:</strong> se molte persone o molti processi chiedono cose insieme, Neon può{" "}
                    <strong>aumentare la potenza</strong> (autoscale verso l&apos;alto). Più potenza per più tempo = più
                    consumo.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800 text-sm font-bold">
                    C
                  </span>
                  <span>
                    <strong>Domande ripetute:</strong> anche una domanda leggera, se ripetuta migliaia di volte al giorno,
                    tiene vivo il database e somma lavoro inutile.
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Separator className="max-w-4xl" />

        {/* Cosa possiamo fare noi — griglia larga */}
        <section aria-labelledby="azioni">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h2 id="azioni" className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Cosa possiamo fare noi (app e operazioni)
              </h2>
              <p className="mt-2 text-slate-600 text-base sm:text-lg max-w-3xl leading-relaxed">
                Sotto trovi le leve che controlliamo noi. Ogni blocco inizia con il <strong>perché</strong>, poi il{" "}
                <strong>cosa fare</strong> in concreto.
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-violet-300 text-violet-800 bg-violet-50">
              Priorità: meno domande inutili al DB
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-violet-100/80 bg-white shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-violet-100 p-2.5">
                    <Server className="h-6 w-6 text-violet-700" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-900">Controlli automatici nel server (backend)</CardTitle>
                    <CardDescription className="text-slate-600 mt-1 text-base leading-relaxed">
                      Il server può chiedere al database &quot;quanti utenti attivi ci sono?&quot; in loop. È utile per
                      le statistiche, ma se lo fa <strong>ogni pochi secondi</strong> è come bussare alla porta in
                      continuazione: il database lavora sempre un po&apos;.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-slate-700 text-base leading-relaxed border-t bg-slate-50/50 pt-5">
                <p>
                  <strong>Cosa fare:</strong> usare un intervallo più ragionevole (ad esempio intorno a un minuto) tramite
                  la variabile d&apos;ambiente <Kbd>PERFORMANCE_OPTIMIZER_METRICS_INTERVAL_MS</Kbd> (valore in
                  millisecondi, es. <Kbd>60000</Kbd> = 60 secondi).
                </p>
                <p>
                  <strong>Monitoraggio interno:</strong> se un servizio legge statistiche pesanti dal database ogni 30
                  secondi, valuta se serve davvero in produzione o se si può rallentare quando non stai osservando il
                  sistema.
                </p>
                <p>
                  <strong>Controlli di salute (health):</strong> strumenti esterni che chiamano &quot;sei vivo?&quot;
                  troppo spesso tengono acceso il collegamento: allenta la frequenza se puoi.
                </p>
                <p>
                  <strong>Job programmati:</strong> attività pianificate (import, pulizie, sync) possono creare picchi se
                  partono tutti insieme: lascia spenti i job non necessari.
                </p>
              </CardContent>
            </Card>

            <Card className="border-indigo-100/80 bg-white shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-indigo-100 p-2.5">
                    <Moon className="h-6 w-6 text-indigo-700" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-900">Pannello Neon (cloud)</CardTitle>
                    <CardDescription className="text-slate-600 mt-1 text-base leading-relaxed">
                      Qui non modifichiamo il codice, ma capiamo <strong>quanto margine</strong> ha il progetto: quanto può
                      scalare la potenza, e quanto spesso il compute va in pausa.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-slate-700 text-base leading-relaxed border-t bg-slate-50/50 pt-5">
                <p>
                  <strong>Autoscale:</strong> se il massimo è alto, sotto traffico intenso Neon può allocare più potenza.
                  Meno traffico e meno richieste contemporanee → meno salti verso l&apos;alto.
                </p>
                <p>
                  <strong>Idle / scale-to-zero:</strong> se c&apos;è sempre qualcosa che parla col database, il compute
                  non riposa mai. Riducendo i ping inutili, aumenti le finestre in cui Neon può mettere il servizio in
                  stato leggero.
                </p>
                <p>
                  Documentazione utile:{" "}
                  <a
                    href="https://neon.com/docs/introduction/compute-lifecycle"
                    className="text-indigo-700 font-medium underline underline-offset-2 hover:text-indigo-900"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Compute lifecycle (Neon)
                  </a>
                  .
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-100/80 bg-white shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-100 p-2.5">
                    <Cpu className="h-6 w-6 text-emerald-800" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-900">Schermate admin e browser</CardTitle>
                    <CardDescription className="text-slate-600 mt-1 text-base leading-relaxed">
                      Ogni pagina che si aggiorna da sola può chiedere dati all&apos;API — e l&apos;API può chiedere dati
                      al database. Più schede aperte, più richieste possono sovrapporsi.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-slate-700 text-base leading-relaxed border-t bg-slate-50/50 pt-5">
                <p>
                  <strong>Cosa fare:</strong> evitare refresh automatici troppo frequenti sulle pagine di monitoraggio;
                  chiudere le schede che non servono quando hai finito di controllare.
                </p>
              </CardContent>
            </Card>

            <Card className="border-sky-100/80 bg-white shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-sky-100 p-2.5">
                    <HeartHandshake className="h-6 w-6 text-sky-800" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-900">Quando vuoi capire un picco preciso</CardTitle>
                    <CardDescription className="text-slate-600 mt-1 text-base leading-relaxed">
                      A volte serve andare un livello più sotto: quali domande al database sono state ripetute tantissime
                      volte? Neon può mostrare statistiche aggregate (strumento tecnico:{" "}
                      <Kbd>pg_stat_statements</Kbd>).
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-slate-700 text-base leading-relaxed border-t bg-slate-50/50 pt-5">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Annota l&apos;orario (meglio in UTC) di un picco sul grafico Neon.</li>
                  <li>
                    Nel SQL Editor di Neon, puoi eseguire una query che elenca le richieste più frequenti (se
                    l&apos;estensione è attiva sul progetto).
                  </li>
                </ol>
                <div>
                  <p className="text-sm font-medium text-slate-800 mb-2">Esempio (per tecnici):</p>
                  <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs sm:text-sm overflow-x-auto leading-relaxed">
                    {`SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;`}
                  </pre>
                </div>
                <p className="text-slate-600 text-sm">
                  Cerca righe che assomigliano a conteggi su tabella utenti, a <Kbd>pg_database_size</Kbd> o a letture di
                  sessioni attive: sono spesso segnali di monitoraggio o statistiche molto ripetute.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ — native details (nessuna dipendenza extra) */}
        <section aria-labelledby="faq-title" className="w-full">
          <h2 id="faq-title" className="text-2xl font-bold text-slate-900 mb-6">
            Domande frequenti (senza gergo)
          </h2>
          <div className="w-full border border-slate-200 rounded-xl bg-white shadow-sm divide-y divide-slate-100 overflow-hidden">
            <details className="group open:bg-violet-50/40">
              <summary className="cursor-pointer list-none px-4 sm:px-6 py-4 text-base font-medium text-slate-900 flex items-center justify-between gap-3 hover:bg-slate-50/80 [&::-webkit-details-marker]:hidden">
                <span>I &quot;300 MB&quot; sul grafico sono un problema da risolvere a parte?</span>
                <span className="text-violet-600 text-xl leading-none shrink-0 group-open:rotate-180 transition-transform">
                  ▾
                </span>
              </summary>
              <div className="px-4 sm:px-6 pb-5 text-slate-700 text-base leading-relaxed border-t border-transparent">
                Spesso no: sono il livello di memoria che Postgres usa quando il compute è al minimo acceso. Il vero tema
                è quanto tempo resta acceso e quante richieste riceve, non la forma esatta del rettangolino sul grafico.
              </div>
            </details>
            <details className="group open:bg-violet-50/40">
              <summary className="cursor-pointer list-none px-4 sm:px-6 py-4 text-base font-medium text-slate-900 flex items-center justify-between gap-3 hover:bg-slate-50/80 [&::-webkit-details-marker]:hidden">
                <span>Posso abbassare i MB &quot;a comando&quot; come il volume della musica?</span>
                <span className="text-violet-600 text-xl leading-none shrink-0 group-open:rotate-180 transition-transform">
                  ▾
                </span>
              </summary>
              <div className="px-4 sm:px-6 pb-5 text-slate-700 text-base leading-relaxed">
                Non esiste un cursore &quot;meno megabyte per picco&quot;. Si riduce il lavoro inutile (meno query
                ripetute, meno traffico), e il grafico segue. In alcuni casi si può anche rivedere il tetto di autoscale
                nel pannello Neon, ma la prima leva è sempre il carico reale.
              </div>
            </details>
            <details className="group open:bg-violet-50/40">
              <summary className="cursor-pointer list-none px-4 sm:px-6 py-4 text-base font-medium text-slate-900 flex items-center justify-between gap-3 hover:bg-slate-50/80 [&::-webkit-details-marker]:hidden">
                <span>Cos&apos;è una &quot;query&quot;?</span>
                <span className="text-violet-600 text-xl leading-none shrink-0 group-open:rotate-180 transition-transform">
                  ▾
                </span>
              </summary>
              <div className="px-4 sm:px-6 pb-5 text-slate-700 text-base leading-relaxed">
                È una domanda formale al database, in linguaggio SQL. Esempio: &quot;Quanti utenti si sono registrati
                nell&apos;ultimo quarto d&apos;ora?&quot; — anche se la risposta è un solo numero, il database deve
                leggerla e calcolarla. Ripeterla ogni 10 secondi significa far lavorare il motore migliaia di volte al
                giorno.
              </div>
            </details>
          </div>
        </section>

        {/* Checklist finale */}
        <section aria-labelledby="checklist">
          <h2 id="checklist" className="text-2xl font-bold text-slate-900 mb-4">
            Checklist — cosa possiamo spuntare nel tempo
          </h2>
          <Card className="border-violet-200 bg-gradient-to-br from-white to-violet-50/40 shadow-md">
            <CardContent className="pt-6 pb-6">
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-800 text-base leading-relaxed">
                <li className="flex gap-3 items-start rounded-lg bg-white/80 p-4 border border-violet-100">
                  <span className="text-violet-500 font-mono text-lg leading-none">□</span>
                  <span>
                    In produzione, impostare <Kbd>PERFORMANCE_OPTIMIZER_METRICS_INTERVAL_MS</Kbd> a non meno di ~60 secondi
                    (salvo esigenze speciali).
                  </span>
                </li>
                <li className="flex gap-3 items-start rounded-lg bg-white/80 p-4 border border-violet-100">
                  <span className="text-violet-500 font-mono text-lg leading-none">□</span>
                  <span>Rivedere job e monitoraggi: frequenze giuste per l&apos;uso reale.</span>
                </li>
                <li className="flex gap-3 items-start rounded-lg bg-white/80 p-4 border border-violet-100">
                  <span className="text-violet-500 font-mono text-lg leading-none">□</span>
                  <span>Dopo un deploy importante, controllare le query più chiamate (se usi le statistiche su Neon).</span>
                </li>
                <li className="flex gap-3 items-start rounded-lg bg-white/80 p-4 border border-violet-100">
                  <span className="text-violet-500 font-mono text-lg leading-none">□</span>
                  <span>Dove serve: cache breve su endpoint admin pesanti; indici solo sulle query davvero lente.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>

        <footer className="text-center text-sm text-slate-500 pb-6">
          Questa pagina è una guida interna: aggiornala quando cambiano intervalli, job o il piano Neon.
        </footer>
      </div>
    </PageContainer>
  );
}
