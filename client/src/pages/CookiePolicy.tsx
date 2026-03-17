import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CookiePolicy() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pt-20">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center mb-4">
            Informativa sui Cookie
          </CardTitle>
          <p className="text-center text-gray-600">
            <strong>DemosApp</strong> - Ultima modifica: {new Date().toLocaleDateString('it-IT')}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Introduzione */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Cosa sono i Cookie</h2>
            <p className="text-gray-700 leading-relaxed">
              I cookie sono piccoli file di testo che vengono memorizzati sul tuo dispositivo 
              quando visiti un sito web. DemosApp utilizza cookie per migliorare la tua 
              esperienza di navigazione e fornire servizi personalizzati.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Questa informativa spiega come utilizziamo i cookie e come puoi gestire 
              le tue preferenze.
            </p>
          </section>

          {/* Tipi di cookie */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Tipi di Cookie Utilizzati</h2>
            
            <h3 className="text-xl font-medium mb-2">2.1 Cookie Necessari (Sempre Attivi)</h3>
            <p className="text-gray-700 mb-3">
              Questi cookie sono essenziali per il funzionamento del sito e non possono essere disabilitati:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Nome Cookie</th>
                    <th className="text-left py-2">Scopo</th>
                    <th className="text-left py-2">Durata</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 font-mono">sidebar:state</td>
                    <td className="py-2">Memorizza lo stato aperto/chiuso della barra laterale</td>
                    <td className="py-2">7 giorni</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-xl font-medium mb-2">2.2 localStorage e sessionStorage</h3>
            <p className="text-gray-700 mb-3">
              DemosApp utilizza <strong>localStorage</strong> e <strong>sessionStorage</strong> invece di cookie HTTP 
              per memorizzare alcuni dati tecnici. Questi non sono cookie HTTP e non richiedono consenso secondo 
              la direttiva ePrivacy, ma sono comunque documentati per trasparenza:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Nome</th>
                    <th className="text-left py-2">Tipo</th>
                    <th className="text-left py-2">Scopo</th>
                    <th className="text-left py-2">Durata</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 font-mono">auth_token</td>
                    <td className="py-2">localStorage</td>
                    <td className="py-2">Token JWT per autenticazione</td>
                    <td className="py-2">Fino al logout</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono">refresh_token</td>
                    <td className="py-2">localStorage</td>
                    <td className="py-2">Token di refresh per autenticazione</td>
                    <td className="py-2">Fino al logout</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono">user_email, user_status, user_id</td>
                    <td className="py-2">localStorage</td>
                    <td className="py-2">Dati utente temporanei</td>
                    <td className="py-2">Fino al logout</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono">app_loaded</td>
                    <td className="py-2">sessionStorage</td>
                    <td className="py-2">Flag per evitare splash screen ripetuti</td>
                    <td className="py-2">Sessione browser</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-700 text-sm italic">
              <strong>Nota:</strong> localStorage e sessionStorage non sono cookie HTTP e non sono soggetti 
              alla direttiva ePrivacy. Tuttavia, il loro utilizzo è documentato nella nostra{" "}
              <a href="/privacy-policy" className="text-blue-600 hover:text-blue-800 underline">
                Privacy Policy
              </a>.
            </p>
          </section>

          {/* Cookie di terze parti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Cookie di Terze Parti</h2>
            <p className="text-gray-700 mb-3">
              Attualmente DemosApp <strong>non utilizza cookie di terze parti</strong> per marketing, 
              analytics o pubblicità. Utilizziamo solo cookie tecnici necessari per il funzionamento 
              della piattaforma.
            </p>
            
            <h3 className="text-xl font-medium mb-2">3.1 Servizi di Hosting</h3>
            <p className="text-gray-700 mb-3">
              Utilizziamo servizi di terze parti per l'hosting e le prestazioni. Questi servizi 
              potrebbero utilizzare cookie tecnici per il funzionamento:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li><strong>Render:</strong> Hosting backend e frontend (sito e API)</li>
              <li><strong>Neon:</strong> Database PostgreSQL</li>
              <li><strong>Resend:</strong> Servizio email</li>
            </ul>
            <p className="text-gray-700 text-sm italic">
              Questi cookie sono tecnici e necessari per il funzionamento del servizio, 
              non richiedono consenso secondo la direttiva ePrivacy.
            </p>
          </section>

          {/* Gestione browser */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Gestione Cookie tramite Browser</h2>
            
            <h3 className="text-xl font-medium mb-2">5.1 Disabilitazione Cookie</h3>
            <p className="text-gray-700 mb-3">
              Puoi disabilitare i cookie tramite le impostazioni del browser:
            </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li><strong>Chrome:</strong> Impostazioni → Privacy e sicurezza → Cookie</li>
                <li><strong>Firefox:</strong> Opzioni → Privacy e sicurezza → Cookie</li>
                <li><strong>Safari:</strong> Preferenze → Privacy → Cookie</li>
                <li><strong>Edge:</strong> Impostazioni → Cookie e autorizzazioni sito</li>
              </ul>

            <h3 className="text-xl font-medium mb-2">5.2 Limitazioni</h3>
            <p className="text-gray-700">
              <strong>Attenzione:</strong> Disabilitare i cookie necessari potrebbe compromettere 
              il funzionamento del sito. Alcune funzionalità potrebbero non essere disponibili.
            </p>
          </section>

          {/* Perché non serve banner */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Perché Non C'è un Banner di Consenso?</h2>
            <p className="text-gray-700 mb-3">
              DemosApp <strong>non mostra un banner di consenso cookie</strong> perché:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Utilizziamo solo <strong>cookie tecnici necessari</strong> (come il cookie della sidebar) 
                  che non richiedono consenso secondo la direttiva ePrivacy</li>
              <li><strong>Non utilizziamo cookie di marketing</strong> (come Google AdSense)</li>
              <li><strong>Non utilizziamo cookie di analytics</strong> (come Google Analytics)</li>
              <li>I dati di autenticazione sono memorizzati in <strong>localStorage</strong>, 
                  che non è un cookie HTTP e non richiede consenso</li>
            </ul>
            <p className="text-gray-700 mb-3">
              Se in futuro aggiungeremo cookie che richiedono consenso (marketing, analytics), 
              implementeremo un banner di consenso conforme al GDPR.
            </p>
          </section>

          {/* Aggiornamenti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Aggiornamenti a Questa Informativa</h2>
            <p className="text-gray-700">
              Questa informativa sui cookie può essere aggiornata periodicamente. 
              Ti informeremo di eventuali modifiche significative tramite notifica 
              nella piattaforma o email.
            </p>
          </section>

          {/* Contatti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">7. Contatti</h2>
            <p className="text-gray-700 mb-3">
              Per domande sui cookie o per esercitare i tuoi diritti:
            </p>
            <ul className="list-none text-gray-700">
              <li><strong>Email:</strong> privacy@demos.community</li>
              <li><strong>Cookie Manager:</strong> cookie@demos.community</li>
            </ul>
          </section>

          {/* Footer */}
          <div className="border-t pt-6 mt-8">
            <p className="text-sm text-gray-500 text-center">
              Questa informativa è conforme al GDPR e alla Direttiva ePrivacy. 
              Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
