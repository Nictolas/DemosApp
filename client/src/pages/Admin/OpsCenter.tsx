import React from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Activity, Scale, Database, HardDrive, Bell, ArrowRight } from "lucide-react";

type OpsSection = "monitoring" | "security" | "compliance";

function getActiveSection(pathname: string): OpsSection {
  if (pathname.includes("/security")) return "security";
  if (pathname.includes("/compliance")) return "compliance";
  return "monitoring";
}

function getSectionLabel(section: OpsSection): string {
  if (section === "security") return "Security";
  if (section === "compliance") return "Compliance";
  return "Monitoring";
}

const OpsCenter: React.FC = () => {
  const [location, setLocation] = useLocation();
  const active = getActiveSection(location);

  const go = (section: OpsSection) => setLocation(`/admin/ops-center/${section}`);

  return (
    <div className="w-full mx-auto px-4 md:px-6 py-8 pt-20 bg-white min-h-screen">
      <div className="mb-6">
        <div className="text-sm text-gray-500 mb-2">
          <span className="font-medium text-gray-700">Ops Center</span>
          <span className="mx-2">/</span>
          <span>{getSectionLabel(active)}</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Ops Center</h1>
        <p className="text-gray-600">
          Punto unico di accesso per operativita, sicurezza e compliance.
        </p>
      </div>

      <div className="grid w-full grid-cols-3 gap-2 mb-6">
        <Button variant={active === "monitoring" ? "default" : "outline"} onClick={() => go("monitoring")}>
          Monitoring
        </Button>
        <Button variant={active === "security" ? "default" : "outline"} onClick={() => go("security")}>
          Security
        </Button>
        <Button variant={active === "compliance" ? "default" : "outline"} onClick={() => go("compliance")}>
          Compliance
        </Button>
      </div>

      {active === "monitoring" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Monitoraggio Sistema</CardTitle>
              <CardDescription>Salute, performance, servizi e trend applicativi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant="outline">Operativita</Badge>
              <Button className="w-full justify-between" onClick={() => setLocation("/monitoring-dashboard/overview")}>
                Apri Panoramica <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Database (Neon)</CardTitle>
              <CardDescription>Connessioni, dimensioni e query lente.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full justify-between" onClick={() => setLocation("/monitoring-dashboard/database")}>
                Apri Dettaglio DB <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Spazio Disco App</CardTitle>
              <CardDescription>Breakdown filesystem server applicativo (Render).</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full justify-between" onClick={() => setLocation("/monitoring-dashboard/disk")}>
                Apri Breakdown Disco <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {active === "security" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Security Dashboard</CardTitle>
              <CardDescription>Eventi, audit, violazioni e metriche sicurezza.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full justify-between" onClick={() => setLocation("/security-dashboard")}>
                Apri Security Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Alert e Log</CardTitle>
              <CardDescription>Controllo rapido su alert operativi e log rilevanti.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full justify-between" onClick={() => setLocation("/logging-dashboard")}>
                Apri Logging <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {active === "compliance" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> GDPR e Legale</CardTitle>
              <CardDescription>Diritti GDPR, data retention, documenti legali.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full justify-between" onClick={() => setLocation("/admin/gdpr-legal")}>
                Apri Gestione GDPR <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" /> Backup e Export</CardTitle>
              <CardDescription>Backup/recovery ed export dati amministrativi.</CardDescription>
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
      )}
    </div>
  );
};

export default OpsCenter;
