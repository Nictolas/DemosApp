import React from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Activity, Scale, Database, HardDrive, Bell, ArrowRight } from "lucide-react";

const OpsCenter: React.FC = () => {
  const [, setLocation] = useLocation();

  return (
    <div className="w-full mx-auto px-4 md:px-6 py-8 pt-20 min-h-screen bg-[radial-gradient(circle_at_top_left,_#eef4ff_0%,_#f6f9ff_36%,_#ffffff_72%)]">
      <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white/85 p-5 md:p-6 shadow-sm backdrop-blur-sm">
        <Badge variant="outline" className="mb-3 text-indigo-700 border-indigo-300">Admin Hub</Badge>
        <h1 className="text-3xl font-bold mb-2">Ops Center</h1>
        <p className="text-slate-600 max-w-4xl">
          Pagina unica per operativita, sicurezza e compliance. Ogni card descrive chiaramente cosa controlla e ti porta al dettaglio corretto.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Monitoring</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Monitoraggio Sistema</CardTitle>
              <CardDescription>Controlla salute piattaforma, performance runtime, memoria, servizi e trend 24h.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant="outline">Operativita</Badge>
              <Button className="w-full justify-between" onClick={() => setLocation("/monitoring-dashboard/overview")}>
                Apri Panoramica <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Database (Neon)</CardTitle>
              <CardDescription>Mostra connessioni, dimensione database e query lente per identificare colli di bottiglia.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full justify-between" onClick={() => setLocation("/monitoring-dashboard/database")}>
                Apri Dettaglio DB <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Spazio Disco App</CardTitle>
              <CardDescription>Analizza il filesystem del server app (Render), con breakdown cartelle piu pesanti.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full justify-between" onClick={() => setLocation("/monitoring-dashboard/disk")}>
                Apri Breakdown Disco <ArrowRight className="h-4 w-4" />
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
              <CardDescription>Raccoglie eventi sicurezza, indicatori di rischio e controlli di conformita operativa.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full justify-between" onClick={() => setLocation("/security-dashboard")}>
                Apri Security Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Alert e Log</CardTitle>
              <CardDescription>Permette di verificare log applicativi e alert critici per diagnosi rapida incidenti.</CardDescription>
            </CardHeader>
            <CardContent>
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
              <CardDescription>Gestione diritti GDPR, policy legali e processi documentali per conformita normativa.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full justify-between" onClick={() => setLocation("/admin/gdpr-legal")}>
                Apri Gestione GDPR <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card className="border-slate-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Backup e Export</CardTitle>
              <CardDescription>Accesso a backup/recovery e strumenti export per governance e tracciabilita dati.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
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
