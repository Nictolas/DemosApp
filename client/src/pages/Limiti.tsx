import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth-neon";

const LIMITS_MOCK = [
  {
    category: "Cloud Firestore",
    limits: [
      { label: "Stored data", value: 0.7, unit: "GiB", max: 1 },
      { label: "Network egress", value: 2, unit: "GiB/mese", max: 10 },
      { label: "Document writes", value: 5000, unit: "/giorno", max: 20000 },
      { label: "Document reads", value: 12000, unit: "/giorno", max: 50000 },
      { label: "Document deletes", value: 1000, unit: "/giorno", max: 20000 },
    ],
  },
  {
    category: "Realtime Database",
    limits: [
      { label: "Connessioni simultanee", value: 40, unit: "", max: 100 },
      { label: "GB memorizzati", value: 0.3, unit: "GB", max: 1 },
      { label: "GB download", value: 2, unit: "GB/mese", max: 10 },
    ],
  },
  {
    category: "Cloud Storage",
    limits: [
      { label: "GB memorizzati", value: 1, unit: "GB", max: 5 },
      { label: "GB scaricati", value: 0.2, unit: "GB/giorno", max: 1 },
      { label: "Operazioni di upload", value: 2000, unit: "/giorno", max: 20000 },
      { label: "Operazioni di download", value: 5000, unit: "/giorno", max: 50000 },
    ],
  },
  {
    category: "Hosting",
    limits: [
      { label: "Storage", value: 2, unit: "GB", max: 10 },
      { label: "Data transfer", value: 100, unit: "MB/giorno", max: 360 },
    ],
  },
  {
    category: "Cloud Functions",
    limits: [
      { label: "Invocazioni", value: 500, unit: "/mese", max: 2000 },
      { label: "GB-seconds", value: 100000, unit: "GB-s/mese", max: 400000 },
      { label: "CPU-seconds", value: 50000, unit: "CPU-s/mese", max: 200000 },
      { label: "Outbound networking", value: 1, unit: "GB/mese", max: 5 },
    ],
  },
  {
    category: "Cloud Build / Artifact Registry",
    limits: [
      { label: "Cloud Build minutes", value: 30, unit: "min/giorno", max: 120 },
      { label: "Container storage", value: 200, unit: "MB", max: 500 },
    ],
  },
  {
    category: "Test Lab",
    limits: [
      { label: "Virtual Device Tests", value: 2, unit: "/giorno", max: 10 },
      { label: "Physical Device Tests", value: 1, unit: "/giorno", max: 5 },
      { label: "Android Device Streaming", value: 10, unit: "min/mese", max: 30 },
    ],
  },
  {
    category: "Data Connect",
    limits: [
      { label: "Network egress", value: 2, unit: "GiB/mese", max: 10 },
      { label: "Operation count", value: 50000, unit: "op/mese", max: 250000 },
    ],
  },
];

function isOverLimit(value: number, max: number) {
  return value / max >= 0.8;
}

function mapApiToLimits(data: any) {
  if (!data) return LIMITS_MOCK;
  return [
    {
      category: "Cloud Firestore",
      limits: [
        { label: "Stored data", ...data.firestore.storedData },
        { label: "Network egress", ...data.firestore.networkEgress },
        { label: "Document writes", ...data.firestore.writes },
        { label: "Document reads", ...data.firestore.reads },
        { label: "Document deletes", ...data.firestore.deletes },
      ],
    },
    {
      category: "Realtime Database",
      limits: [
        { label: "Connessioni simultanee", ...data.realtimeDb.connections },
        { label: "GB memorizzati", ...data.realtimeDb.storedGB },
        { label: "GB download", ...data.realtimeDb.downloadGB },
      ],
    },
    {
      category: "Cloud Storage",
      limits: [
        { label: "GB memorizzati", ...data.storage.storedGB },
        { label: "GB scaricati", ...data.storage.downloadGB },
        { label: "Operazioni di upload", ...data.storage.uploads },
        { label: "Operazioni di download", ...data.storage.downloads },
      ],
    },
    {
      category: "Hosting",
      limits: [
        { label: "Storage", ...data.hosting.storage },
        { label: "Data transfer", ...data.hosting.dataTransfer },
      ],
    },
    {
      category: "Cloud Functions",
      limits: [
        { label: "Invocazioni", ...data.functions.invocations },
        { label: "GB-seconds", ...data.functions.gbSeconds },
        { label: "CPU-seconds", ...data.functions.cpuSeconds },
        { label: "Outbound networking", ...data.functions.outbound },
      ],
    },
    {
      category: "Cloud Build / Artifact Registry",
      limits: [
        { label: "Cloud Build minutes", ...data.build.minutes },
        { label: "Container storage", ...data.build.container },
      ],
    },
    {
      category: "Test Lab",
      limits: [
        { label: "Virtual Device Tests", ...data.testlab.virtual },
        { label: "Physical Device Tests", ...data.testlab.physical },
        { label: "Android Device Streaming", ...data.testlab.streaming },
      ],
    },
    {
      category: "Data Connect",
      limits: [
        { label: "Network egress", ...data.dataconnect.egress },
        { label: "Operation count", ...data.dataconnect.ops },
      ],
    },
  ];
}

const limiti = [
  {
    nome: "Letture Firestore",
    limite: "50.000/giorno",
  },
  {
    nome: "Scritture Firestore",
    limite: "20.000/giorno",
  },
  {
    nome: "Eliminazioni Firestore",
    limite: "20.000/giorno",
  },
  {
    nome: "Storage",
    limite: "1 GB",
  },
  {
    nome: "Download Storage",
    limite: "10 GB/mese",
  },
  {
    nome: "Upload Storage",
    limite: "1 GB/giorno",
  },
  {
    nome: "Autenticazioni",
    limite: "10.000/mese",
  },
  {
    nome: "Cloud Functions",
    limite: "125.000 invocazioni/mese",
  },
];

export default function Limiti() {
  const { user } = useAuth();
  const [limits, setLimits] = useState(LIMITS_MOCK);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = user?.ruolo === "Admin";

  const fetchLimits = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/limiti");
      if (!res.ok) throw new Error("Errore nel recupero dei limiti");
      const data = await res.json();
      setLimits(mapApiToLimits(data));
      setLastUpdate(new Date());
    } catch (e: any) {
      setError(e.message || "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchLimits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleRefresh = () => {
    fetchLimits();
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Accesso Riservato</CardTitle>
            <CardDescription>Solo gli amministratori possono visualizzare i limiti in tempo reale.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-4xl">
        <Card className="mb-6">
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <CardTitle className="text-2xl font-bold">Monitoraggio Limiti Firebase</CardTitle>
              <CardDescription>Controlla in tempo reale il superamento dei limiti del piano gratuito</CardDescription>
            </div>
            <Button onClick={handleRefresh} variant="outline" disabled={loading}>{loading ? "Aggiornamento..." : "Aggiorna dati"}</Button>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-2">Ultimo aggiornamento: {lastUpdate.toLocaleString()}</div>
            {error && <div className="text-red-500 mb-4">{error}</div>}
            {limits.map(section => (
              <div key={section.category} className="mb-6">
                <h3 className="font-semibold text-lg mb-2">{section.category}</h3>
                <div className="space-y-2">
                  {section.limits.map(limit => (
                    <div key={limit.label} className="relative">
                      {isOverLimit(limit.value, limit.max) && (
                        <div className="absolute left-0 right-0 top-0 z-10 bg-red-500 text-white text-xs px-2 py-1 rounded-t-md text-center animate-pulse">
                          Attenzione: superato l'80% del limite gratuito!
                        </div>
                      )}
                      <div className={`flex items-center gap-4 p-3 rounded-md border ${isOverLimit(limit.value, limit.max) ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}`}>
                        <span className="font-medium w-56">{limit.label}</span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={isOverLimit(limit.value, limit.max) ? 'bg-red-500' : 'bg-blue-500'} style={{ width: `${Math.min(100, (limit.value / limit.max) * 100)}%`, height: '100%' }} />
                        </div>
                        <span className="ml-2 font-mono text-sm">{limit.value} {limit.unit} / {limit.max} {limit.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Limiti del piano Spark (Firebase)</CardTitle>
            <CardDescription>
              Qui puoi consultare i principali limiti del piano gratuito di Firebase. Per vedere l'utilizzo reale e aggiornato delle risorse, clicca il pulsante qui sotto:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href="https://console.firebase.google.com/u/0/project/demos-finale/usage/details"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 mb-6 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Vai alla pagina dei limiti e consumi su Firebase
            </a>
            <ul>
              {limiti.map((l) => (
                <li key={l.nome} className="mb-3 flex justify-between border-b pb-1">
                  <span className="font-semibold">{l.nome}</span>
                  <span>{l.limite}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 text-sm text-gray-600">
              <b>Nota:</b> L'utilizzo reale delle risorse è visibile solo dalla console Firebase.<br />
              Se superi i limiti, alcune funzionalità dell'app potrebbero essere temporaneamente bloccate.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 