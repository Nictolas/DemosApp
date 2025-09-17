import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pt-20">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center mb-4">
            Informativa sulla Privacy
          </CardTitle>
          <p className="text-center text-gray-600">
            <strong>DemosApp</strong> - Ultima modifica: {new Date().toLocaleDateString('it-IT')}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Introduzione */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Introduzione</h2>
            <p className="text-gray-700 leading-relaxed">
              DemosApp ("noi", "nostro" o "ci") rispetta la tua privacy e si impegna a proteggere 
              i tuoi dati personali. Questa informativa spiega come raccogliamo, utilizziamo, 
              conserviamo e proteggiamo le tue informazioni quando utilizzi la nostra piattaforma 
              di democrazia partecipativa.
            </p>
          </section>

          {/* Dati raccolti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Dati Personali che Raccogliamo</h2>
            
            <h3 className="text-xl font-medium mb-2">2.1 Dati di Registrazione</h3>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li><strong>Dati anagrafici:</strong> Nome, cognome, data di nascita, genere</li>
              <li><strong>Dati di contatto:</strong> Indirizzo email</li>
              <li><strong>Dati di residenza:</strong> Paese, regione, provincia, comune di residenza</li>
              <li><strong>Dati di cittadinanza:</strong> Cittadinanza, paese di elezione</li>
              <li><strong>Codice fiscale:</strong> Per la verifica dell'identità</li>
            </ul>

            <h3 className="text-xl font-medium mb-2">2.2 Dati Politici e di Voto</h3>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li><strong>Opinioni politiche:</strong> Su temi come energia nucleare, sperimentazione animale, 
                  legalizzazione canapa, caccia, eutanasia, matrimonio gay, salario minimo</li>
              <li><strong>Dati di voto:</strong> Voti per capo di stato, referendum, iniziative popolari, ICE</li>
              <li><strong>Dati di candidatura:</strong> Informazioni su candidature elettorali</li>
              <li><strong>Dati di elezione:</strong> Grado di elezione, circoscrizioni elettorali</li>
            </ul>

            <h3 className="text-xl font-medium mb-2">2.3 Dati Tecnici</h3>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li><strong>Dati di navigazione:</strong> Indirizzo IP, user agent, cookie</li>
              <li><strong>Dati di autenticazione:</strong> Token di sessione, password (hash)</li>
              <li><strong>Preferenze:</strong> Impostazioni notifiche, configurazione avatar</li>
            </ul>
          </section>

          {/* Finalità */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Finalità del Trattamento</h2>
            <p className="text-gray-700 mb-3">Utilizziamo i tuoi dati per:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li><strong>Funzionamento della piattaforma:</strong> Registrazione, autenticazione, gestione account</li>
              <li><strong>Democrazia partecipativa:</strong> Raccolta e gestione di voti, opinioni, iniziative</li>
              <li><strong>Comunicazione:</strong> Invio di notifiche, aggiornamenti, comunicazioni importanti</li>
              <li><strong>Analisi e miglioramento:</strong> Analisi anonima per migliorare i servizi</li>
              <li><strong>Conformità legale:</strong> Adempimento di obblighi di legge</li>
            </ul>
          </section>

          {/* Base giuridica */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Base Giuridica del Trattamento</h2>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li><strong>Consenso esplicito (Art. 6.1.a GDPR):</strong> Per dati politici e di voto</li>
              <li><strong>Esecuzione contratto (Art. 6.1.b GDPR):</strong> Per fornire i servizi richiesti</li>
              <li><strong>Interesse legittimo (Art. 6.1.f GDPR):</strong> Per migliorare la piattaforma</li>
              <li><strong>Obbligo legale (Art. 6.1.c GDPR):</strong> Per adempimenti normativi</li>
            </ul>
          </section>

          {/* Conservazione */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Conservazione dei Dati</h2>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li><strong>Dati di account:</strong> Fino alla cancellazione dell'account</li>
              <li><strong>Dati di voto:</strong> Conservati in forma anonima per 5 anni</li>
              <li><strong>Dati di comunicazione:</strong> 3 anni dall'ultima interazione</li>
              <li><strong>Dati tecnici:</strong> 12 mesi per sicurezza e debugging</li>
            </ul>
          </section>

          {/* Sicurezza */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Misure di Sicurezza</h2>
            <p className="text-gray-700 mb-3">Implementiamo misure tecniche e organizzative per proteggere i tuoi dati:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li><strong>Crittografia:</strong> Dati trasmessi e memorizzati in forma crittografata</li>
              <li><strong>Autenticazione sicura:</strong> Auth.js con token JWT</li>
              <li><strong>Database sicuro:</strong> PostgreSQL su Neon (UE) con connessioni SSL</li>
              <li><strong>Accesso limitato:</strong> Solo personale autorizzato può accedere ai dati</li>
              <li><strong>Backup sicuri:</strong> Backup regolari e crittografati</li>
              <li><strong>Monitoraggio:</strong> Log di accesso e monitoraggio delle attività</li>
            </ul>
          </section>

          {/* Condivisione */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">7. Condivisione dei Dati</h2>
            <p className="text-gray-700 mb-3">Non vendiamo i tuoi dati. Li condividiamo solo con:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li><strong>Fornitori di servizi:</strong> Neon (database), Resend (email), Vercel (hosting)</li>
              <li><strong>Autorità competenti:</strong> Solo se richiesto per legge</li>
              <li><strong>Consenso esplicito:</strong> Per altre finalità con il tuo consenso</li>
            </ul>
          </section>

          {/* Diritti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">8. I Tuoi Diritti (GDPR)</h2>
            <p className="text-gray-700 mb-3">Hai il diritto di:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li><strong>Accesso:</strong> Ottenere una copia dei tuoi dati</li>
              <li><strong>Rettifica:</strong> Correggere dati inesatti</li>
              <li><strong>Cancellazione:</strong> Richiedere la cancellazione dei tuoi dati</li>
              <li><strong>Limitazione:</strong> Limitare il trattamento in determinate circostanze</li>
              <li><strong>Portabilità:</strong> Ricevere i tuoi dati in formato strutturato</li>
              <li><strong>Opposizione:</strong> Opporti al trattamento per motivi legittimi</li>
              <li><strong>Revoca consenso:</strong> Revocare il consenso in qualsiasi momento</li>
            </ul>
            <p className="text-gray-700">
              Per esercitare questi diritti, contattaci all'indirizzo: <strong>privacy@demos.community</strong>
            </p>
          </section>

          {/* Cookie */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">9. Cookie e Tecnologie Simili</h2>
            <p className="text-gray-700 mb-3">Utilizziamo cookie per:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li><strong>Cookie necessari:</strong> Funzionamento del sito (sempre attivi)</li>
              <li><strong>Cookie di marketing:</strong> Google AdSense (solo con consenso)</li>
              <li><strong>Cookie di preferenze:</strong> Impostazioni utente</li>
            </ul>
            <p className="text-gray-700">
              Puoi gestire le tue preferenze sui cookie tramite il banner di consenso o 
              le impostazioni del browser.
            </p>
          </section>

          {/* Trasferimenti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">10. Trasferimenti Internazionali</h2>
            <p className="text-gray-700">
              I tuoi dati sono memorizzati su server situati nell'Unione Europea (Neon - Francoforte). 
              Eventuali trasferimenti verso paesi terzi avvengono solo con garanzie adeguate 
              e nel rispetto del GDPR.
            </p>
          </section>

          {/* Minori */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">11. Protezione dei Minori</h2>
            <p className="text-gray-700">
              La nostra piattaforma è rivolta a utenti maggiorenni. Non raccogliamo 
              consapevolmente dati di minori di 18 anni. Se scopriamo di aver raccolto 
              dati di un minore, li cancelleremo immediatamente.
            </p>
          </section>

          {/* Modifiche */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">12. Modifiche a Questa Informativa</h2>
            <p className="text-gray-700">
              Potremmo aggiornare questa informativa periodicamente. Ti informeremo 
              di eventuali modifiche significative tramite email o notifica nella piattaforma. 
              La data dell'ultima modifica è indicata in cima a questo documento.
            </p>
          </section>

          {/* Contatti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">13. Contatti</h2>
            <p className="text-gray-700 mb-3">
              Per domande su questa informativa o per esercitare i tuoi diritti:
            </p>
            <ul className="list-none text-gray-700">
              <li><strong>Email:</strong> privacy@demos.community</li>
              <li><strong>Responsabile del trattamento:</strong> DemosApp Team</li>
              <li><strong>Autorità di controllo:</strong> Garante per la Protezione dei Dati Personali</li>
            </ul>
          </section>

          {/* Footer */}
          <div className="border-t pt-6 mt-8">
            <p className="text-sm text-gray-500 text-center">
              Questa informativa è conforme al Regolamento (UE) 2016/679 (GDPR) 
              e al D.Lgs. 196/2003 (Codice Privacy).
          </p>
        </div>

        </CardContent>
      </Card>
    </div>
  );
} 
