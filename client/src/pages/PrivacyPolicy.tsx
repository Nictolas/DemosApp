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
              <li><strong>Promozione e marketing:</strong> Pubblicazione di dati aggregati e anonimi sui social media 
                  e altre piattaforme digitali per promuovere la piattaforma e divulgare i risultati dei sondaggi</li>
              <li><strong>Conformità legale:</strong> Adempimento di obblighi di legge</li>
            </ul>
          </section>

          {/* Base giuridica */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Base Giuridica del Trattamento</h2>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li><strong>Consenso esplicito (Art. 6.1.a GDPR):</strong> Per dati di voto e altre finalità</li>
              <li><strong>Esecuzione contratto (Art. 6.1.b GDPR):</strong> Per fornire i servizi richiesti</li>
              <li><strong>Interesse legittimo (Art. 6.1.f GDPR):</strong> Per migliorare la piattaforma</li>
              <li><strong>Obbligo legale (Art. 6.1.c GDPR):</strong> Per adempimenti normativi</li>
            </ul>
            
            <h3 className="text-xl font-medium mb-2 mt-4">4.1 Trattamento di Dati Particolari - Opinioni Politiche (GDPR Art. 9)</h3>
            <p className="text-gray-700 mb-3">
              Le <strong>opinioni politiche</strong> sono considerate "dati particolari" secondo il GDPR Art. 9 
              e richiedono un <strong>consenso esplicito separato</strong>.
            </p>
            <p className="text-gray-700 mb-3">
              <strong>Base giuridica specifica:</strong> Consenso esplicito dell'interessato (GDPR Art. 9.2.a)
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Il consenso alle opinioni politiche è <strong>opzionale</strong> e può essere rifiutato</li>
              <li>Se rifiuti il consenso, non potrai esprimere opinioni politiche ma potrai utilizzare tutte le altre funzionalità della piattaforma</li>
              <li>Il consenso può essere <strong>revocato in qualsiasi momento</strong> dalle impostazioni del profilo</li>
              <li>In caso di revoca, le opinioni politiche già espresse verranno <strong>anonimizzate</strong> (mantenute per statistiche aggregate ma non più associate al tuo account)</li>
              <li>Il consenso viene registrato con data, ora, indirizzo IP e user agent per finalità di audit e conformità</li>
            </ul>
            <p className="text-gray-700 mb-3">
              <strong>Finalità del trattamento:</strong> Le opinioni politiche vengono utilizzate esclusivamente per:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Permettere l'espressione della tua opinione su temi politici</li>
              <li>Generare statistiche aggregate e anonime sull'opinione pubblica</li>
              <li>Confrontare le tue opinioni con quelle dei rappresentanti politici</li>
              <li>Migliorare la piattaforma di democrazia partecipativa</li>
            </ul>
            <p className="text-gray-700">
              <strong>Nessuna profilazione politica:</strong> Le tue opinioni politiche non vengono utilizzate 
              per creare profili politici o per finalità di marketing politico.
            </p>
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

          {/* Utilizzo dati aggregati per marketing */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">8. Utilizzo di Dati Aggregati per Marketing e Pubblicazione</h2>
            <p className="text-gray-700 mb-3">
              Con il tuo consenso esplicito (fornito accettando i Termini e Condizioni d'Uso), 
              utilizziamo i dati aggregati e anonimi derivanti dai sondaggi e dalle votazioni 
              della piattaforma per finalità di promozione e marketing.
            </p>
            
            <h3 className="text-xl font-medium mb-2">8.1 Pubblicazione sui Social Media</h3>
            <p className="text-gray-700 mb-3">
              Pubbliciamo sui nostri canali social media (inclusi ma non limitati a Facebook, 
              Instagram, Twitter, LinkedIn, TikTok e altre piattaforme digitali) dati statistici 
              aggregati e anonimi per:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Promuovere la piattaforma DemosApp e incrementare la partecipazione democratica</li>
              <li>Divulgare i risultati dei sondaggi e delle votazioni in forma aggregata</li>
              <li>Comunicare pubblicamente l'opinione aggregata degli utenti su temi di interesse</li>
              <li>Incrementare la visibilità e la consapevolezza della piattaforma</li>
            </ul>
            
            <h3 className="text-xl font-medium mb-2">8.2 Garanzie di Anonimato</h3>
            <p className="text-gray-700 mb-3">
              I dati pubblicati sui social media e altre piattaforme contengono <strong>esclusivamente</strong>:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Statistiche aggregate (percentuali, totali, medie, distribuzioni)</li>
              <li>Dati anonimi che non permettono l'identificazione di singoli utenti</li>
              <li>Statistiche geografiche (nazionali, regionali, provinciali, comunali) solo quando 
                  il campione è sufficientemente ampio da garantire l'anonimato</li>
            </ul>
            <p className="text-gray-700 mb-3">
              <strong>Non pubblichiamo mai:</strong> nomi, email, dati anagrafici, codici fiscali, 
              o qualsiasi altra informazione che permetta l'identificazione di singoli utenti.
            </p>
            
            <h3 className="text-xl font-medium mb-2">8.3 Base Giuridica</h3>
            <p className="text-gray-700 mb-3">
              L'utilizzo di dati aggregati per marketing e pubblicazione si basa sul tuo 
              <strong> consenso esplicito</strong> (Art. 6.1.a GDPR), fornito accettando i 
              Termini e Condizioni d'Uso della piattaforma. Puoi revocare il consenso in 
              qualsiasi momento contattandoci all'indirizzo <strong>privacy@demos.community</strong>.
            </p>
            <p className="text-gray-700 mb-3">
              Per ulteriori dettagli sull'utilizzo dei dati aggregati, consulta la sezione 
              8.1 dei{" "}
              <a href="/terms-of-service" className="text-blue-600 hover:text-blue-800 underline">
                Termini e Condizioni d'Uso
              </a>.
            </p>
          </section>

          {/* Diritti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">9. I Tuoi Diritti (GDPR)</h2>
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
            <h2 className="text-2xl font-semibold mb-3">10. Cookie e Tecnologie Simili</h2>
            <p className="text-gray-700 mb-3">Utilizziamo esclusivamente cookie tecnici necessari per il funzionamento del sito:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li><strong>Cookie necessari:</strong> Funzionamento del sito (sempre attivi, non richiedono consenso)</li>
              <li><strong>Cookie di sessione:</strong> Per l'autenticazione e la gestione della sessione utente</li>
              <li><strong>Cookie di preferenze:</strong> Per memorizzare le impostazioni dell'utente (es. stato sidebar)</li>
            </ul>
            <p className="text-gray-700 mb-3">
              <strong>Non utilizziamo cookie di marketing o di profilazione</strong> che richiederebbero il tuo consenso. 
              I cookie tecnici utilizzati non richiedono consenso secondo la direttiva ePrivacy.
            </p>
            <p className="text-gray-700">
              Per maggiori dettagli, consulta la nostra{" "}
              <a href="/cookie-policy" className="text-blue-600 hover:text-blue-800 underline">
                Cookie Policy
              </a>.
            </p>
          </section>

          {/* Trasferimenti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">11. Trasferimenti Internazionali</h2>
            <p className="text-gray-700">
              I tuoi dati sono memorizzati su server situati nell'Unione Europea (Neon - Francoforte). 
              Eventuali trasferimenti verso paesi terzi avvengono solo con garanzie adeguate 
              e nel rispetto del GDPR.
            </p>
          </section>

          {/* Minori */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">12. Protezione dei Minori</h2>
            <p className="text-gray-700">
              La nostra piattaforma è rivolta a utenti maggiorenni. Non raccogliamo 
              consapevolmente dati di minori di 18 anni. Se scopriamo di aver raccolto 
              dati di un minore, li cancelleremo immediatamente.
            </p>
          </section>

          {/* Modifiche */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">13. Modifiche a Questa Informativa</h2>
            <p className="text-gray-700">
              Potremmo aggiornare questa informativa periodicamente. Ti informeremo 
              di eventuali modifiche significative tramite email o notifica nella piattaforma. 
              La data dell'ultima modifica è indicata in cima a questo documento.
            </p>
          </section>

          {/* Contatti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">14. Contatti</h2>
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
