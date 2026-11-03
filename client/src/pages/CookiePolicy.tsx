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
            <strong>DemosApp</strong> - Ultima modifica del testo: 02/11/2026
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
              <dl className="sm:hidden space-y-2 text-sm">
                <div><dt className="font-semibold">Nome Cookie</dt><dd className="font-mono break-all">sidebar:state</dd></div>
                <div><dt className="font-semibold">Scopo</dt><dd>Memorizza lo stato aperto/chiuso della barra laterale</dd></div>
                <div><dt className="font-semibold">Durata</dt><dd>7 giorni</dd></div>
              </dl>
              <table className="hidden sm:table w-full text-sm">
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
              per memorizzare alcuni dati tecnici. Queste tecnologie non sono cookie
              HTTP, ma rientrano comunque nelle regole applicabili alla memorizzazione
              o all'accesso ai dati sul dispositivo; gli usi strettamente necessari
              al servizio possono beneficiare delle eccezioni previste:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <dl className="sm:hidden space-y-3 text-sm">
                <div className="border-b pb-2">
                  <dt className="font-mono font-semibold break-all">auth_token</dt>
                  <dd><strong>Tipo:</strong> localStorage</dd>
                  <dd><strong>Scopo:</strong> Token JWT per autenticazione</dd>
                  <dd><strong>Durata:</strong> Fino al logout</dd>
                </div>
                <div className="border-b pb-2">
                  <dt className="font-mono font-semibold break-all">refresh_token</dt>
                  <dd><strong>Tipo:</strong> localStorage</dd>
                  <dd><strong>Scopo:</strong> Token di refresh per autenticazione</dd>
                  <dd><strong>Durata:</strong> Fino al logout</dd>
                </div>
                <div>
                  <dt className="font-mono font-semibold break-all">user_email, user_status, user_id</dt>
                  <dd><strong>Tipo:</strong> localStorage</dd>
                  <dd><strong>Scopo:</strong> Dati utente temporanei</dd>
                  <dd><strong>Durata:</strong> Fino al logout</dd>
                </div>
              </dl>
              <table className="hidden sm:table w-full text-sm">
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
                </tbody>
              </table>
            </div>
            <p className="text-gray-700 text-sm italic">
              <strong>Nota:</strong> localStorage e sessionStorage non sono cookie HTTP,
              ma l'obbligo di consenso dipende dalla finalità e dalle eccezioni applicabili,
              non dal nome della tecnologia. Per ulteriori dettagli consulta la nostra{" "}
              <a href="/privacy-policy" className="text-blue-600 hover:text-blue-800 underline">
                Privacy Policy
              </a>.
            </p>
          </section>

          {/* Cookie di terze parti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Cookie di Terze Parti</h2>
            <p className="text-gray-700 mb-3">
              Attualmente il <strong>sito web DEMOS non utilizza cookie pubblicitari
              di Google AdMob o Google AdSense</strong>. La pubblicità nativa Android
              è un progetto separato e non è attiva nelle release distribuite.
              Le tecnologie tecniche necessarie al funzionamento del sito restano
              distinte dagli eventuali strumenti pubblicitari futuri.
            </p>
            
            <h3 className="text-xl font-medium mb-2">3.1 Servizi di Hosting</h3>
            <p className="text-gray-700 mb-3">
              Utilizziamo servizi di terze parti per l'hosting e le prestazioni. Questi servizi 
              potrebbero utilizzare cookie tecnici per il funzionamento:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li><strong>Render:</strong> Hosting backend e frontend (sito e API)</li>
              <li><strong>Supabase:</strong> Database PostgreSQL</li>
              <li><strong>Resend:</strong> Servizio email</li>
            </ul>
            <p className="text-gray-700 text-sm italic">
              Questi cookie sono tecnici e necessari per il funzionamento del servizio, 
              non richiedono consenso secondo la direttiva ePrivacy.
            </p>
          </section>

          {/* Informativa preventiva sulla futura integrazione nativa */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">
              3.2 Identificatori e strumenti pubblicitari Android (non ancora attivi)
            </h2>
            <p className="text-gray-700 mb-3">
              DEMOS sta preparando annunci non personalizzati all'apertura dell'app
              Android tramite Google AdMob e un messaggio per la gestione del consenso
              tramite Google UMP. <strong>Gli SDK pubblicitari non sono presenti nelle
              versioni release attualmente distribuite.</strong> Se abilitati in una
              versione futura, questi servizi potrebbero accedere a identificatori
              pubblicitari o del dispositivo, indirizzo IP e dati tecnici e diagnostici,
              anche senza utilizzare cookie del browser.
            </p>
            <p className="text-gray-700">
              Prima dell'attivazione verranno aggiornate le informazioni sul trattamento
              effettivo e le dichiarazioni Google Play. Dove previsto, gli utenti
              potranno accettare, rifiutare o gestire il consenso tramite un messaggio
              nell'app Android. La gestione della privacy pubblicitaria è separata
              da quella relativa alle opinioni politiche DEMOS. Per ulteriori
              informazioni consulta la{' '}
              <a href="/privacy-policy" className="text-blue-600 hover:text-blue-800 underline">
                Informativa sulla privacy
              </a>.
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
              <li>I dati di autenticazione possono essere memorizzati in <strong>localStorage</strong>:
                  l'eventuale esenzione dal consenso deriva dalla necessità tecnica,
                  non dal fatto che non siano cookie HTTP</li>
            </ul>
            <p className="text-gray-700 mb-3">
              Se in futuro introdurremo sul sito tecnologie pubblicitarie che richiedono
              consenso, attiveremo un sistema di gestione delle scelte adeguato prima
              del loro utilizzo. La futura gestione del consenso Android con UMP
              è distinta dal banner per il sito web.
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
              Ultimo aggiornamento del testo: 02/11/2026
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
