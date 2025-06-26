import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AnalisiConsumi() {
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
            <CardTitle>Analisi Consumi e Limiti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-1">1. Banda (100 GB/mese)</h3>
              <p>
                Il consumo di banda dipende dal peso degli asset (JS, CSS, immagini) e dal numero di sessioni utente. Se ogni utente effettua 1-2 sessioni complete al mese, il traffico totale resta sotto i 100 GB. Se gli utenti accedono più spesso, si rischia di superare il limite. Ottimizza asset e usa cache/CDN per restare nei limiti.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">2. Serverless GB-hr (100 GB-hr/mese)</h3>
              <p>
                Le funzioni serverless (API) consumano pochissimo: anche con 1.000.000 di chiamate al mese, resti molto sotto il limite. Nessun rischio di sforamento con l&apos;architettura attuale.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">3. Edge Invocazioni (500.000/mese)</h3>
              <p>
                Ogni operazione che richiede una funzione Edge conta come una invocazione. Se ogni utente effettua 2 sessioni al mese con 2 chiamate Edge, resti sotto il limite. Se la frequenza o le chiamate aumentano, puoi superare il tetto. Usa Edge solo dove necessario.
              </p>
            </div>
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
                  <b>Analizza i file JS:</b> Dopo la build, Vite mostra il peso dei bundle principali. Per analisi avanzata, installa <code>source-map-explorer</code> e lancia <code>npx source-map-explorer dist/assets/*.js</code>.
                </li>
                <li className="mb-1">
                  <b>Ripeti dopo ogni modifica importante</b> per monitorare la crescita del bundle.
                </li>
              </ol>
              <div className="text-gray-500 text-xs">
                Consiglio: ottimizza immagini (WebP), minifica JS/CSS, usa CDN e cache per ridurre il traffico per utente.
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Monitoraggio automatico: strumenti consigliati</h3>
              <ul className="list-disc ml-6 mb-2">
                <li className="mb-1">
                  <b>Bundle Analyzer:</b> Installa <code>vite-plugin-visualizer</code> per generare un report automatico del peso del bundle dopo ogni build. <br />
                  <span className="text-gray-500 text-xs">Esempio in <code>vite.config.ts</code>:</span>
                  <pre className="bg-gray-100 p-2 text-xs overflow-x-auto">import visualizer from 'vite-plugin-visualizer';
plugins: [visualizer({ open: false, filename: 'bundle-report.html' })]</pre>
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
            <div className="mt-4 text-sm text-gray-500">
              <b>Nota:</b> Queste stime sono indicative e vanno monitorate con dati reali di traffico e utilizzo.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 