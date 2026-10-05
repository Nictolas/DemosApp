import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, FileText, Database, User, Mail, Calendar, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DownloadData {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  size?: string;
  lastUpdated?: string;
}

const dataTypes: DownloadData[] = [
  {
    id: "profile",
    name: "Profilo Completo",
    description: "Tutti i dati del tuo profilo personale",
    icon: <User className="h-5 w-5" />,
    size: "~2KB",
    lastUpdated: "Sempre aggiornato"
  },
  {
    id: "opinions",
    name: "Opinioni e Voti",
    description: "Tutte le tue opinioni e voti espressi",
    icon: <FileText className="h-5 w-5" />,
    size: "~5KB",
    lastUpdated: "Sempre aggiornato"
  },
  {
    id: "activity",
    name: "Cronologia Attività",
    description: "Log delle tue attività sulla piattaforma",
    icon: <Calendar className="h-5 w-5" />,
    size: "~10KB",
    lastUpdated: "Sempre aggiornato"
  },
  {
    id: "complete",
    name: "Dati Completi",
    description: "Tutti i tuoi dati in un unico file",
    icon: <Database className="h-5 w-5" />,
    size: "~20KB",
    lastUpdated: "Sempre aggiornato"
  }
];

export default function ScaricaDati() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (dataType: string) => {
    if (!user) return;

    setDownloading(dataType);
    setError(null);

    try {
      // Simula il download dei dati
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Qui implementeremo la chiamata API reale
      const response = await fetch(`/api/user/download-data?type=${dataType}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Errore durante il download dei dati');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dati-${dataType}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il download');
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-b from-blue-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Accesso Richiesto</CardTitle>
            <CardDescription>Devi effettuare il login per scaricare i tuoi dati.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation('/auth')}>
              Vai al Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-blue-50 to-white page-with-navbar">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/impostazioni')}
            className="mb-4"
          >
            ← Torna alle Impostazioni
          </Button>
          
          <Card className="border-0 shadow-lg bg-linear-to-r from-blue-600 to-purple-600 text-white">
            <CardHeader className="text-center py-6">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Download className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold mb-2">
                Scarica i Tuoi Dati
              </CardTitle>
              <CardDescription className="text-blue-100 text-lg">
                Hai il diritto di scaricare tutti i dati che ci hai fornito
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Informazioni GDPR */}
        <Alert className="mb-6 bg-white">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Secondo il GDPR, hai il diritto di ottenere una copia dei tuoi dati personali. 
            I dati vengono forniti in formato JSON leggibile e contengono tutte le informazioni 
            che abbiamo raccolto su di te.
          </AlertDescription>
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6 bg-white">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Data Types Grid */}
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
                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Dimensione:</span>
                    <span>{data.size}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Ultimo aggiornamento:</span>
                    <span>{data.lastUpdated}</span>
                  </div>
                  
                  <Button 
                    onClick={() => handleDownload(data.id)}
                    disabled={downloading === data.id}
                    className="w-full"
                  >
                    {downloading === data.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Scaricamento...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Scarica {data.name}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Info */}
        <Card className="mt-8 bg-white">
          <CardHeader>
            <CardTitle>Informazioni Aggiuntive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">
                <strong>Formato dei dati:</strong> I dati vengono scaricati in formato JSON, 
                facilmente leggibile e processabile.
              </p>
              <p className="mb-2">
                <strong>Frequenza:</strong> Puoi scaricare i tuoi dati in qualsiasi momento, 
                senza limitazioni.
              </p>
              <p className="mb-2">
                <strong>Privacy:</strong> I dati scaricati contengono solo le informazioni 
                che hai fornito volontariamente alla piattaforma.
              </p>
              <p>
                <strong>Supporto:</strong> Se hai problemi con il download, contattaci 
                all'indirizzo supporto@demos.community
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
