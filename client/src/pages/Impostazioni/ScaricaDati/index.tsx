import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, FileText, Database, User, Calendar, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";

interface DownloadData {
  id: "profile" | "opinions" | "activity" | "complete";
  name: string;
  description: string;
  icon: React.ReactNode;
}

const dataTypes: DownloadData[] = [
  {
    id: "profile",
    name: "Profilo Completo",
    description: "Dati dell'account, profilo, consensi e provider di autenticazione",
    icon: <User className="h-5 w-5" />,
  },
  {
    id: "opinions",
    name: "Opinioni Politiche",
    description: "Le risposte politiche associate al tuo account",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    id: "activity",
    name: "Attività e Voti",
    description: "Voti, attività politica, comunicazioni, notifiche e log associati al tuo account",
    icon: <Calendar className="h-5 w-5" />,
  },
  {
    id: "complete",
    name: "Dati Completi",
    description: "Profilo, opinioni e attività in un unico file",
    icon: <Database className="h-5 w-5" />,
  },
];

export default function ScaricaDati() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (dataType: DownloadData["id"]) => {
    if (!user) return;

    setDownloading(dataType);
    setError(null);

    try {
      const response = await apiRequest(
        "GET",
        `/api/user/download-data?type=${encodeURIComponent(dataType)}`
      );

      const payload = response.data;
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `dati-${dataType}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il download");
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Accesso Richiesto</CardTitle>
            <CardDescription>Devi effettuare il login per scaricare i tuoi dati.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/auth")}>Vai al Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white page-with-navbar">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => setLocation("/impostazioni")} className="mb-4">
            ← Torna alle Impostazioni
          </Button>

          <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <CardHeader className="text-center py-6">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Download className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold mb-2">Scarica i Tuoi Dati</CardTitle>
              <CardDescription className="text-blue-100 text-lg">
                Esporta i dati personali associati al tuo account in formato JSON
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Alert className="mb-6 bg-white">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            L'esportazione viene generata al momento della richiesta usando lo schema dati corrente. Il file è destinato esclusivamente all'utente autenticato.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive" className="mb-6 bg-white">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {dataTypes.map((data) => (
            <Card key={data.id} className="hover:shadow-lg transition-shadow bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  {data.icon}
                  {data.name}
                </CardTitle>
                <CardDescription>{data.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => handleDownload(data.id)}
                  disabled={downloading !== null}
                  className="w-full"
                >
                  {downloading === data.id ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Preparazione...</>
                  ) : (
                    <><Download className="h-4 w-4 mr-2" />Scarica {data.name}</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8 bg-white">
          <CardHeader>
            <CardTitle>Informazioni Aggiuntive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Formato:</strong> JSON strutturato e leggibile automaticamente.</p>
            <p><strong>Aggiornamento:</strong> il contenuto viene generato usando i dati presenti al momento della richiesta.</p>
            <p><strong>Supporto:</strong> per problemi con l'esportazione scrivi a privacy@demos.community.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
