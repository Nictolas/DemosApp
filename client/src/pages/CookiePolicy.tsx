import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CookiePolicy() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
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
                  <tr className="border-b">
                    <td className="py-2 font-mono">auth-token</td>
                    <td className="py-2">Autenticazione utente</td>
                    <td className="py-2">Sessione</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono">session-id</td>
                    <td className="py-2">Identificazione sessione</td>
                    <td className="py-2">Sessione</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono">csrf-token</td>
                    <td className="py-2">Protezione CSRF</td>
                    <td className="py-2">Sessione</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono">Cookiebot</td>
                    <td className="py-2">Gestione consenso cookie</td>
                    <td className="py-2">1 anno</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-xl font-medium mb-2">2.2 Cookie di Preferenze</h3>
            <p className="text-gray-700 mb-3">
              Questi cookie memorizzano le tue preferenze per personalizzare l'esperienza:
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
                  <tr className="border-b">
                    <td className="py-2 font-mono">theme-preference</td>
                    <td className="py-2">Tema scuro/chiaro</td>
                    <td className="py-2">1 anno</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono">language</td>
                    <td className="py-2">Lingua preferita</td>
                    <td className="py-2">1 anno</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono">notifications</td>
                    <td className="py-2">Preferenze notifiche</td>
                    <td className="py-2">6 mesi</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-xl font-medium mb-2">2.3 Cookie di Marketing (Solo con Consenso)</h3>
            <p className="text-gray-700 mb-3">
              Questi cookie sono utilizzati per mostrare pubblicità personalizzata:
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
                  <tr className="border-b">
                    <td className="py-2 font-mono">_gcl_au</td>
                    <td className="py-2">Google AdSense</td>
                    <td className="py-2">3 mesi</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono">_gid</td>
                    <td className="py-2">Google Analytics</td>
                    <td className="py-2">24 ore</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono">ads_preferences</td>
                    <td className="py-2">Preferenze pubblicitarie</td>
                    <td className="py-2">1 anno</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Cookie di terze parti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Cookie di Terze Parti</h2>
            
            <h3 className="text-xl font-medium mb-2">3.1 Google AdSense</h3>
            <p className="text-gray-700 mb-3">
              Utilizziamo Google AdSense per mostrare annunci pubblicitari. 
              Google può utilizzare cookie per personalizzare gli annunci.
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li><strong>Finalità:</strong> Pubblicità personalizzata</li>
              <li><strong>Privacy Policy:</strong> <a href="https://policies.google.com/privacy" className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a></li>
              <li><strong>Opt-out:</strong> <a href="https://adssettings.google.com/" className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">Google Ad Settings</a></li>
            </ul>

            <h3 className="text-xl font-medium mb-2">3.2 Servizi di Hosting</h3>
            <p className="text-gray-700 mb-3">
              Utilizziamo servizi di terze parti per l'hosting e le prestazioni:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li><strong>Vercel:</strong> Hosting e CDN</li>
              <li><strong>Neon:</strong> Database PostgreSQL</li>
              <li><strong>Resend:</strong> Servizio email</li>
            </ul>
          </section>

          {/* Gestione consenso */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Gestione del Consenso</h2>
            
            <h3 className="text-xl font-medium mb-2">4.1 Banner di Consenso</h3>
            <p className="text-gray-700 mb-3">
              Al primo accesso al sito, apparirà un banner che ti permette di:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Accettare tutti i cookie</li>
              <li>Rifiutare i cookie non necessari</li>
              <li>Personalizzare le tue preferenze</li>
              <li>Leggere informazioni dettagliate</li>
            </ul>

            <h3 className="text-xl font-medium mb-2">4.2 Modifica Preferenze</h3>
            <p className="text-gray-700 mb-3">
              Puoi modificare le tue preferenze sui cookie in qualsiasi momento:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Cliccando sul link "Gestisci Cookie" nel footer</li>
              <li>Accedendo alle impostazioni del tuo account</li>
              <li>Utilizzando le impostazioni del browser</li>
            </ul>
          </section>

          {/* Gestione browser */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Gestione Cookie tramite Browser</h2>
            
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

          {/* Cookie specifici DemosApp */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Cookie Specifici di DemosApp</h2>
            
            <h3 className="text-xl font-medium mb-2">6.1 Cookie di Autenticazione</h3>
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <p className="text-gray-700 mb-2">
                <strong>auth-token:</strong> Token JWT per l'autenticazione sicura
              </p>
              <p className="text-sm text-gray-600">
                Durata: Sessione | Necessario: Sì | Scopo: Sicurezza
              </p>
            </div>

            <h3 className="text-xl font-medium mb-2">6.2 Cookie di Preferenze Politiche</h3>
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <p className="text-gray-700 mb-2">
                <strong>political-preferences:</strong> Memorizza le preferenze di voto
              </p>
              <p className="text-sm text-gray-600">
                Durata: 1 anno | Necessario: No | Scopo: Personalizzazione
              </p>
            </div>

            <h3 className="text-xl font-medium mb-2">6.3 Cookie di Sicurezza</h3>
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <p className="text-gray-700 mb-2">
                <strong>security-hash:</strong> Hash per verificare l'integrità dei dati
              </p>
              <p className="text-sm text-gray-600">
                Durata: Sessione | Necessario: Sì | Scopo: Sicurezza
              </p>
            </div>
          </section>

          {/* Aggiornamenti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">7. Aggiornamenti a Questa Informativa</h2>
            <p className="text-gray-700">
              Questa informativa sui cookie può essere aggiornata periodicamente. 
              Ti informeremo di eventuali modifiche significative tramite notifica 
              nella piattaforma o email.
            </p>
          </section>

          {/* Contatti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">8. Contatti</h2>
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
