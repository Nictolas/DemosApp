import React from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Activity, Scale, Database, HardDrive, Bell, ArrowRight, SlidersHorizontal } from "lucide-react";

const OpsCenter: React.FC = () => {
  const [, setLocation] = useLocation();

  return (
    <div className="w-full mx-auto px-4 md:px-6 py-8 pt-20 min-h-screen bg-[radial-gradient(circle_at_top_left,_#eef4ff_0%,_#f6f9ff_36%,_#ffffff_72%)]">
      <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white/85 p-5 md:p-6 shadow-sm backdrop-blur-sm">
        <Badge variant="outline" className="mb-3 text-indigo-700 border-indigo-300">Admin Hub</Badge>
        <h1 className="text-3xl font-bold mb-2">Ops Center</h1>
        <p className="text-slate-600 max-w-4xl">
          Pagina unica per operativita, sicurezza e compliance, pensata anche per chi non e tecnico: ogni card spiega in modo semplice a cosa serve e cosa puoi farci.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Monitoring</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
              <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" /> Parametri Piani Free</CardTitle>
              <CardDescription>Ti mostra i limiti delle piattaforme free con percentuali di utilizzo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Cosa puoi farci: vedere in un punto unico quanto margine resta su Cursor, Neon e altre voci operative.
              </p>
              <Button className="w-full justify-between" onClick={() => setLocation("/admin/parametri")}>
                Apri Parametri <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Security</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Security Dashboard</CardTitle>
              <CardDescription>Raccoglie segnali di sicurezza per capire se ci sono rischi o anomalie.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Cosa puoi farci: controllare rapidamente la situazione sicurezza e priorita di intervento.
              </p>
              <Button className="w-full justify-between" onClick={() => setLocation("/security-dashboard")}>
                Apri Security Dashboard <ArrowRight className="h-4 w-4" />
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
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Compliance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Backup e Export</CardTitle>
              <CardDescription>Ti permette di mettere al sicuro i dati e scaricarli quando serve.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-slate-600">
                Cosa puoi farci: avviare backup, pianificare recupero e fare export per verifiche o report.
              </p>
              <Button variant="outline" className="w-full justify-between" onClick={() => setLocation("/backup-dashboard")}>
                Backup Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="w-full justify-between" onClick={() => setLocation("/admin/data-export")}>
                Data Export <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default OpsCenter;
