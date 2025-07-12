import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, Info, BarChart2, AlertTriangle, CheckCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { analytics, perf, crashlytics, logEvent } from "../lib/firebase";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const LIMITS = [
  { name: "Banda", value: "100 GB/mese", icon: <BarChart2 className="h-5 w-5 text-blue-600 inline" />, key: "banda", description: "Traffico totale dati (download/upload) generato dagli utenti." },
  { name: "Serverless GB-hr", value: "100 GB-hr/mese", icon: <BarChart2 className="h-5 w-5 text-green-600 inline" />, key: "serverless", description: "Tempo totale di esecuzione delle funzioni serverless (API)." },
  { name: "Edge Invocazioni", value: "500.000/mese", icon: <BarChart2 className="h-5 w-5 text-cyan-600 inline" />, key: "edge", description: "Numero di chiamate alle funzioni Edge (API Routes, Middleware, ecc.)." },
];

const ESTIMATES = [
  { key: "banda", value: "~30-60 GB/mese (1-2 sessioni/utente)" },
  { key: "serverless", value: "~50-80 ore/mese (1M chiamate)" },
  { key: "edge", value: "~400.000/mese (2 sessioni/utente)" },
];

export default function AnalisiConsumi() {
  const [dynamicData, setDynamicData] = useState({
    bundleSize: '...',
    apiCalls: '...',
    bandwidth: '...',
    serverlessGBhr: '...',
    edgeInvocations: '...'
  });
  const [firebaseConsumi, setFirebaseConsumi] = useState(null);
  const [chartDataState, setChartDataState] = useState([12, 18, 22, 30, 35, 41]);
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch('/api/monitoring-consumi')
      .then(res => res.json())
      .then(data => {
        setDynamicData({
          bundleSize: (data.bundleSize || 0) + ' KB',
          apiCalls: (data.apiCalls || 0) + '/mese',
          bandwidth: (data.bandwidth || 0) + ' GB/mese',
          serverlessGBhr: (data.serverlessGBhr || 0) + ' GB-hr/mese',
          edgeInvocations: (data.edgeInvocations || 0) + '/mese',
        });
        if (data.trafficHistory) setChartDataState(data.trafficHistory);
      })
      .catch(() => setDynamicData({
        bundleSize: 'N/A',
        apiCalls: 'N/A',
        bandwidth: 'N/A',
        serverlessGBhr: 'N/A',
        edgeInvocations: 'N/A',
      }))
      .finally(() => setLoading(false));
  };

  const fetchFirebaseConsumi = async () => {
    try {
      const response = await fetch('/api/firebase-monitoring');
      const data = await response.json();
      setFirebaseConsumi(data);
    } catch (error) {
      console.error('Errore nel recupero consumi Firebase:', error);
      setFirebaseConsumi({ error: 'Errore nel recupero dati' });
    }
  };

  useEffect(() => {
    fetchData();
    fetchFirebaseConsumi();
    // Traccia la visualizzazione della pagina
    if (analytics) {
      logEvent(analytics, "page_view", { page: "AnalisiConsumi" });
    }
    // Esempio: logga un errore di test su Crashlytics (decommenta per test reale)
    // if (crashlytics) crashlytics.recordError(new Error("Test Crashlytics su AnalisiConsumi"));
    // Esempio: custom trace per Performance Monitoring
    if (perf) {
      const trace = perf.trace("analisi_consumi_render");
      trace.start();
      setTimeout(() => {
        trace.stop();
      }, 1000);
    }
  }, []);

  const handleAggiorna = async () => {
    setLoading(true);
    await fetch('/api/monitoring-consumi-update', {
      method: 'POST',
      headers: { 'X-API-KEY': 'supersegreto2024!' }
    });
    fetchData();
    fetchFirebaseConsumi(); // Aggiorna anche i dati Firebase
  };

  const chartData = {
    labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu'],
    datasets: [
      {
        label: 'Traffico (GB)',
        data: chartDataState,
        backgroundColor: 'rgba(37, 99, 235, 0.6)',
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Traffico mensile (GB)' },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => window.location.href = "/gestisci"}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna a Gestisci
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <BarChart2 className="h-6 w-6 text-blue-600" />
              Analisi Consumi e Limiti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tabella limiti vs stime */}
            <div>
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">Limiti e Stime
                <Info className="h-4 w-4 text-gray-400" aria-label="Limiti del piano e stime di consumo attuale" />
              </h3>
              <table className="w-full text-sm border border-gray-200 mb-2 bg-white rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-cyan-100">
                    <th className="p-2 border">Risorsa</th>
                    <th className="p-2 border">Limite</th>
                    <th className="p-2 border">Stima attuale</th>
                  </tr>
                </thead>
                <tbody>
                  {LIMITS.map(limite => (
                    <tr key={limite.key}>
                      <td className="p-2 border font-medium flex items-center gap-2">{limite.icon} {limite.name}</td>
                      <td className="p-2 border">{limite.value}</td>
                      <td className="p-2 border">{ESTIMATES.find(e => e.key === limite.key)?.value || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-xs text-gray-500 flex flex-col gap-1">
                {LIMITS.map(limite => (
                  <span key={limite.key}><Info className="inline h-3 w-3 mr-1 text-gray-400" /> <b>{limite.name}:</b> {limite.description}</span>
                ))}
              </div>
            </div>

            {/* Cosa succede se superi i limiti */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex gap-3 items-start">
              <AlertTriangle className="h-6 w-6 text-yellow-500 mt-1" />
              <div>
                <h4 className="font-semibold mb-1">Cosa succede se superi i limiti?</h4>
                <ul className="list-disc ml-6 text-sm">
                  <li>Le API potrebbero essere bloccate o rallentate.</li>
                  <li>Potresti incorrere in costi extra (se il piano lo prevede).</li>
                  <li>Gli utenti potrebbero vedere errori o tempi di attesa più lunghi.</li>
                  <li>Alcuni provider (es. Vercel) potrebbero sospendere temporaneamente il servizio.</li>
                </ul>
              </div>
            </div>

            {/* Consigli pratici */}
            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-md flex gap-3 items-start">
              <CheckCircle className="h-6 w-6 text-green-500 mt-1" />
              <div>
                <h4 className="font-semibold mb-1">Consigli pratici per restare nei limiti</h4>
                <ul className="list-disc ml-6 text-sm">
                  <li>Ottimizza immagini e asset statici (usa formati moderni come WebP).</li>
                  <li>Minimizza e splitta il bundle JS/CSS.</li>
                  <li>Usa una CDN per asset statici.</li>
                  <li>Riduci le chiamate API/Edge non necessarie.</li>
                  <li>Monitora regolarmente i consumi tramite dashboard.</li>
                </ul>
              </div>
            </div>

            {/* Link rapidi */}
            <div className="space-y-2">
              <h4 className="font-semibold mb-1 flex items-center gap-2">Dashboard e Monitoraggio <ExternalLink className="h-4 w-4 text-blue-500" /></h4>
              <ul className="list-disc ml-6 text-sm">
                <li><a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Vercel Dashboard</a></li>
                <li><a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Firebase Console</a></li>
                <li><a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Analytics</a></li>
              </ul>
            </div>

            {/* Chiamate API/Edge per sessione utente */}
            <div>
              <h3 className="font-semibold text-lg mb-1">Chiamate API/Edge per sessione utente</h3>
              <p className="mb-2">
                Ecco una stima delle chiamate API/Edge generate da una sessione utente tipica:
              </p>
              <table className="w-full text-sm border border-gray-200 mb-2">
                <thead>
                  <tr className="bg-cyan-100">
                    <th className="p-2 border">Azione</th>
                    <th className="p-2 border">Chiamate API/Edge</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border">Login</td>
                    <td className="p-2 border">1</td>
                  </tr>
                  <tr>
                    <td className="p-2 border">Registrazione</td>
                    <td className="p-2 border">1</td>
                  </tr>
                  <tr>
                    <td className="p-2 border">Navigazione menu</td>
                    <td className="p-2 border">1</td>
                  </tr>
                  <tr>
                    <td className="p-2 border">Apertura pagina dinamica (es. Gestisci Utenti)</td>
                    <td className="p-2 border">1 per pagina</td>
                  </tr>
                  <tr>
                    <td className="p-2 border">Azione (modifica, aggiunta, salvataggio)</td>
                    <td className="p-2 border">1 per azione</td>
                  </tr>
                </tbody>
              </table>
              <div className="text-gray-500 text-xs">
                Una sessione semplice genera circa 2-4 chiamate; una sessione attiva può arrivare a 5-10 chiamate.
              </div>
            </div>

            {/* Come calcolare il peso reale del bundle */}
            <div>
              <h3 className="font-semibold text-lg mb-1">Come calcolare il peso reale del bundle</h3>
              <ol className="list-decimal ml-6 mb-2">
                <li className="mb-1">
                  <b>Fai la build di produzione:</b> <code>npm run build</code> nella root del progetto.
                </li>
                <li className="mb-1">
                  <b>Controlla la cartella <code>dist</code>:</b> Vai in <code>client/dist</code>, tasto destro → Proprietà per vedere la dimensione totale.
                </li>
                <li className="mb-1">
                  <b>Usa PowerShell per il totale:</b> <code>Get-ChildItem -Recurse | Measure-Object -Property Length -Sum</code> nella cartella <code>dist</code>.
                </li>
                <li className="mb-1">
                  <b>Analizza i file JS:</b> Dopo la build, Vite mostra il peso dei bundle principali. Per analisi avanzata, installa <code>vite-plugin-visualizer</code> e lancia <code>npm run build</code> per generare il report.
                </li>
                <li className="mb-1">
                  <b>Ripeti dopo ogni modifica importante</b> per monitorare la crescita del bundle.
                </li>
              </ol>
              <div className="text-gray-500 text-xs">
                Consiglio: ottimizza immagini (WebP), minifica JS/CSS, usa CDN e cache per ridurre il traffico per utente.
              </div>
            </div>

            {/* Monitoraggio automatico: strumenti consigliati */}
            <div>
              <h3 className="font-semibold text-lg mb-1">Monitoraggio automatico: strumenti consigliati</h3>
              <ul className="list-disc ml-6 mb-2">
                <li className="mb-1">
                  <b>Bundle Analyzer:</b> Installa <code>vite-plugin-visualizer</code> per generare un report automatico del peso del bundle dopo ogni build. <br />
                  <span className="text-gray-500 text-xs">Esempio in <code>vite.config.ts</code>:</span>
                  <pre className="bg-gray-100 p-2 text-xs overflow-x-auto">plugins: [visualizer(/* opzioni qui */)]</pre>
                  <span className="text-gray-500 text-xs">Dopo <code>npm run build</code> trovi <code>bundle-report.html</code> nella root.</span>
                </li>
                <li className="mb-1">
                  <b>Logging API/Edge:</b> Aggiungi <code>console.log</code> in ogni endpoint per tracciare le chiamate. <br />
                  <span className="text-gray-500 text-xs">Esempio:</span>
                  <pre className="bg-gray-100 p-2 text-xs overflow-x-auto">console.log('[API] chiamata ricevuta');</pre>
                  <span className="text-gray-500 text-xs">Consulta i log su Vercel/Firebase dashboard.</span>
                </li>
                <li className="mb-1">
                  <b>Google Analytics 4:</b> Installa <code>react-ga4</code> per tracciare pageview e azioni utente.<br />
                  <span className="text-gray-500 text-xs">Esempio:</span>
                  <pre className="bg-gray-100 p-2 text-xs overflow-x-auto">import ReactGA from "react-ga4";
ReactGA.initialize("G-XXXXXXXXXX");
ReactGA.event(...);</pre>
                </li>
                <li className="mb-1">
                  <b>Dashboard provider:</b> Usa le dashboard di <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Vercel</a> o <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Firebase</a> per monitorare traffico, invocazioni, errori e banda in tempo reale.
                </li>
              </ul>
              <div className="text-gray-500 text-xs">
                Integra questi strumenti per avere dati reali e ricevere alert automatici in caso di superamento soglie.
              </div>
            </div>

            {/* Consumi Firebase Reali */}
            {firebaseConsumi && (
              <div className="bg-white border border-orange-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-orange-600" />
                    Consumi Firebase Reali
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-500">
                      Ultimo aggiornamento: {firebaseConsumi.timestamp ? new Date(firebaseConsumi.timestamp).toLocaleString('it-IT') : 'N/A'}
                    </div>
                    <Button onClick={fetchFirebaseConsumi} disabled={loading} variant="outline" size="sm">
                      {loading ? 'Aggiornamento...' : 'Aggiorna Firebase'}
                    </Button>
                  </div>
                </div>
                
                {firebaseConsumi.error ? (
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    Errore nel recupero dati: {firebaseConsumi.error}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Firestore */}
                    <div className="bg-blue-50 rounded-lg p-3">
                      <h4 className="font-semibold text-blue-800 mb-2">Firestore</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Letture:</span>
                          <span className="font-mono">{firebaseConsumi.firestore?.reads?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Scritture:</span>
                          <span className="font-mono">{firebaseConsumi.firestore?.writes?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Totale:</span>
                          <span className="font-mono">{firebaseConsumi.firestore?.total?.toLocaleString() || '0'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Functions */}
                    <div className="bg-green-50 rounded-lg p-3">
                      <h4 className="font-semibold text-green-800 mb-2">Cloud Functions</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Invocazioni:</span>
                          <span className="font-mono">{firebaseConsumi.functions?.invocations?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tempo esecuzione:</span>
                          <span className="font-mono">{firebaseConsumi.functions?.executionTime?.toFixed(2) || '0'} ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GB-seconds:</span>
                          <span className="font-mono">{firebaseConsumi.functions?.gbSeconds?.toFixed(2) || '0'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Hosting */}
                    <div className="bg-purple-50 rounded-lg p-3">
                      <h4 className="font-semibold text-purple-800 mb-2">Hosting</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Richieste:</span>
                          <span className="font-mono">{firebaseConsumi.hosting?.requests?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bytes trasferiti:</span>
                          <span className="font-mono">{firebaseConsumi.hosting?.bytesTransferred?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GB trasferiti:</span>
                          <span className="font-mono">{firebaseConsumi.hosting?.gbTransferred?.toFixed(2) || '0'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Storage */}
                    <div className="bg-yellow-50 rounded-lg p-3">
                      <h4 className="font-semibold text-yellow-800 mb-2">Storage</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Oggetti:</span>
                          <span className="font-mono">{firebaseConsumi.storage?.objectCount?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bytes utilizzati:</span>
                          <span className="font-mono">{firebaseConsumi.storage?.bytesUsed?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GB utilizzati:</span>
                          <span className="font-mono">{firebaseConsumi.storage?.gbUsed?.toFixed(2) || '0'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dati dinamici */}
            <div className="bg-white border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">Dati dinamici (reali)</h3>
                <Button onClick={handleAggiorna} disabled={loading} variant="outline" size="sm">
                  {loading ? 'Aggiornamento...' : 'Aggiorna'}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-blue-700">{dynamicData.bundleSize}</span>
                  <span className="text-xs text-gray-500">Bundle JS/CSS</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-blue-700">{dynamicData.apiCalls}</span>
                  <span className="text-xs text-gray-500">Chiamate API/Edge</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-blue-700">{dynamicData.bandwidth}</span>
                  <span className="text-xs text-gray-500">Banda usata</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-blue-700">{dynamicData.serverlessGBhr}</span>
                  <span className="text-xs text-gray-500">Serverless GB-hr</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-blue-700">{dynamicData.edgeInvocations}</span>
                  <span className="text-xs text-gray-500">Edge Invocazioni</span>
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-2">
                <Bar data={chartData} options={chartOptions} height={180} />
              </div>
              <div className="text-xs text-gray-500 mt-2">* Dati di esempio. Integra una API o variabili di ambiente per valori reali.</div>
            </div>

            <div className="mt-4 text-sm text-gray-500">
              <b>Nota:</b> Queste stime sono indicative e vanno monitorate con dati reali di traffico e utilizzo.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 