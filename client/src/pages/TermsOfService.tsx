import React from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Revisione documentale: non utilizzare la data di visualizzazione come data di modifica.
const TERMS_VERSION = '08/11/2026';

export default function TermsOfService() {
  const [, navigate] = useLocation();
  const from = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('from') : null;

  return (
    <div className={`container mx-auto px-4 py-8 max-w-4xl pt-20 ${from ? 'pb-28' : 'pb-28'}`}>
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center mb-4">
            Termini e Condizioni d'Uso
          </CardTitle>
          <p className="text-center text-gray-600">
            <strong>Demos</strong> — Versione dei termini: {TERMS_VERSION}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Introduzione */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Introduzione</h2>
            <p className="text-gray-700 leading-relaxed">
              Benvenuto su Demos, la piattaforma di democrazia partecipativa che connette cittadini 
              e rappresentanti politici. Questi Termini e Condizioni regolano l'uso della nostra 
              piattaforma e dei servizi offerti.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Utilizzando Demos, accetti di essere vincolato da questi termini. Se non accetti 
              questi termini, non utilizzare la nostra piattaforma.
            </p>
          </section>

          {/* Definizioni */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Definizioni</h2>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li><strong>"Piattaforma"</strong> - Il sito web e i servizi di Demos</li>
              <li><strong>"Utente"</strong> - Chiunque utilizzi la piattaforma</li>
              <li><strong>"Contenuto"</strong> - Opinioni, preferenze e comunicazioni pubblicate</li>
              <li><strong>"Servizi"</strong> - Funzionalità di voto, opinioni, rappresentanza</li>
              <li><strong>"Account"</strong> - Profilo utente registrato</li>
            </ul>
          </section>

          {/* Accettazione */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Accettazione dei Termini</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Per creare un account e utilizzare le funzioni riservate agli utenti registrati, devi:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Avere almeno 18 anni di età</li>
              <li>Indicare in modo veritiero la tua cittadinanza e il tuo paese di residenza, anche se diversi dall'Italia</li>
              <li>Fornire informazioni veritiere e accurate</li>
              <li>Rispettare le leggi italiane ed europee</li>
              <li>Non utilizzare la piattaforma per scopi illegali</li>
            </ul>
          </section>

          {/* Servizi offerti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Servizi Offerti</h2>
            <p className="text-gray-700 mb-3">Demos fornisce i seguenti servizi:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li><strong>Democrazia Partecipativa:</strong> Espressione di opinioni su temi politici</li>
              <li><strong>Preferenze e consultazioni:</strong> Espressione delle scelte disponibili nelle singole sezioni, secondo le relative regole</li>
              <li><strong>Rappresentanza:</strong> Collegamento con rappresentanti politici</li>
              <li><strong>Iniziative e referendum:</strong> Informazioni civiche e, ove disponibili, collegamenti ai portali istituzionali per le procedure ufficiali</li>
              <li><strong>Comunicazione:</strong> Scambio di informazioni con rappresentanti</li>
              <li><strong>Trasparenza:</strong> Consultazione di dati e statistiche pubbliche e, quando disponibili, di votazioni istituzionali tratte da fonti ufficiali</li>
            </ul>
            <p className="text-gray-700 mb-3">
              Alcune funzioni possono non essere ancora disponibili. Le versioni Android future possono mostrare
              annunci pubblicitari solo dopo l'attivazione della relativa integrazione, secondo le preferenze
              di consenso applicabili e le informative pubblicate. Eventuali servizi a pagamento
              saranno descritti prima della loro attivazione.
            </p>
          </section>

          {/* Obblighi utente */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Obblighi dell'Utente</h2>
            <h3 className="text-xl font-medium mb-2">5.1 Uso Responsabile</h3>
            <p className="text-gray-700 mb-3">L'utente si impegna a:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Utilizzare la piattaforma solo per scopi legittimi</li>
              <li>Non interferire con il funzionamento del sistema</li>
              <li>Non tentare di accedere ad account altrui</li>
              <li>Non diffondere malware o contenuti dannosi</li>
              <li>Rispettare la privacy degli altri utenti</li>
            </ul>

            <h3 className="text-xl font-medium mb-2">5.2 Contenuti Pubblicati</h3>
            <p className="text-gray-700 mb-3">L'utente garantisce che i contenuti pubblicati:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Non presentino consapevolmente informazioni false come fatti accertati</li>
              <li>Non violino diritti di terzi</li>
              <li>Non contengano materiale offensivo o illegale</li>
              <li>Rispettino la dignità umana</li>
              <li>Siano pertinenti al contesto democratico</li>
            </ul>

            <h3 className="text-xl font-medium mb-2 mt-4">5.3 Contenuti Generati dagli Utenti</h3>
            <p className="text-gray-700 mb-3">
              L'utente è responsabile dei contenuti che pubblica, nel rispetto delle
              norme applicabili. Demos valuta le segnalazioni e interviene sui contenuti
              illeciti o contrari ai termini secondo gli obblighi di legge.
            </p>
            <p className="text-gray-700 mb-3">
              Demos può, nei limiti previsti dalla legge:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Moderare, oscurare o rimuovere contenuti che violino questi termini o la legge</li>
              <li>Rimuovere contenuti offensivi, diffamatori, illegali o inappropriati</li>
              <li>Sospendere o chiudere account che pubblicano contenuti inappropriati</li>
              <li>Collaborare con le autorità competenti in caso di contenuti illegali</li>
            </ul>
            <p className="text-gray-700 mb-3">
              L'utente garantisce che i contenuti pubblicati:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Non violano diritti di proprietà intellettuale di terzi</li>
              <li>Non contengono materiale diffamatorio, offensivo o discriminatorio</li>
              <li>Non promuovono attività illegali</li>
              <li>Rispettano la dignità umana e i principi democratici</li>
              <li>Non contengono informazioni false o fuorvianti</li>
            </ul>
            <p className="text-gray-700 mb-3">
              L'utente concede a Demos una licenza non esclusiva e gratuita, limitata
              alle operazioni necessarie per ospitare, visualizzare e moderare i contenuti
              pubblicati nell'ambito dei servizi. Restano fermi i diritti dell'utente,
              inclusi quelli relativi alla cancellazione e alla protezione dei dati personali.
            </p>

            <h3 className="text-xl font-medium mb-2 mt-4">5.4 Account e Identità</h3>
            <h4 className="text-lg font-medium mb-2 mt-3">5.4.1 Creazione e Gestione Account</h4>
            <p className="text-gray-700 mb-3">
              L'utente può creare un solo account sulla piattaforma. È vietato:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Creare account multipli utilizzando identità diverse o false</li>
              <li>Condividere le credenziali di accesso con terzi</li>
              <li>Utilizzare account di altri utenti</li>
              <li>Trasferire il proprio account a terzi</li>
            </ul>
            <p className="text-gray-700 mb-3">
              L'utente è responsabile di:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Mantenere la riservatezza delle proprie credenziali di accesso</li>
              <li>Notificare immediatamente Demos in caso di uso non autorizzato dell'account</li>
              <li>Fornire informazioni veritiere e accurate durante la registrazione</li>
              <li>Aggiornare le proprie informazioni personali quando necessario</li>
            </ul>

            <h4 className="text-lg font-medium mb-2 mt-3">5.4.2 Verifica dell'Identità</h4>
            <p className="text-gray-700 mb-3">
              Demos può richiedere la verifica dell'identità dell'utente in qualsiasi momento, 
              specialmente per:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Utenti che si registrano come rappresentanti politici</li>
              <li>Utenti che richiedono funzioni soggette a verifiche specifiche dell'identità</li>
              <li>Utenti che mostrano comportamenti sospetti o inappropriati</li>
            </ul>
            <p className="text-gray-700 mb-3">
              La mancata verifica dell'identità quando richiesta può comportare la sospensione 
              o la chiusura dell'account.
            </p>

            <h4 className="text-lg font-medium mb-2 mt-3">5.4.3 Sicurezza dell'Account</h4>
            <p className="text-gray-700 mb-3">
              L'utente è responsabile di tutte le attività che avvengono tramite il proprio account. 
              Demos non è responsabile per perdite o danni derivanti da:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Uso non autorizzato dell'account dovuto a negligenza dell'utente</li>
              <li>Condivisione delle credenziali con terzi</li>
              <li>Attacchi informatici che compromettono la sicurezza dell'account dell'utente</li>
            </ul>
          </section>

          {/* Accuratezza contenuti politici */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Accuratezza delle Informazioni sui Rappresentanti Politici</h2>
            <p className="text-gray-700 mb-3">
              Demos presenta informazioni su rappresentanti politici e, ove disponibili,
              posizioni e votazioni nominali ricavate da fonti pubbliche.
              Tuttavia, l'utente riconosce che:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>I dati sulle posizioni e le votazioni dei rappresentanti politici potrebbero
                  contenere errori o imprecisioni</li>
              <li>Le informazioni potrebbero non essere sempre aggiornate o complete</li>
              <li>Demos non garantisce l'accuratezza assoluta di tali contenuti</li>
              <li>L'utente è invitato a verificare le informazioni attraverso fonti ufficiali</li>
            </ul>
            <p className="text-gray-700 mb-3">
              Se riscontri errori o imprecisioni nelle opinioni o nelle informazioni relative ai 
              rappresentanti politici, ti invitiamo a segnalarli utilizzando l'apposito modulo 
              disponibile alla pagina{" "}
              <a 
                href="/segnala-problema" 
                className="text-blue-600 hover:text-blue-800 underline font-medium"
              >
                Segnala Problema
              </a>
              . Ogni segnalazione verrà presa in considerazione e verrà fatto il possibile per 
              correggere eventuali errori nel più breve tempo possibile.
            </p>
          </section>

          {/* Votazioni */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">7. Sistema di Votazione</h2>
            <h3 className="text-xl font-medium mb-2">7.1 Regole di Voto</h3>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Le preferenze e le risposte sono gestite secondo le regole di ciascuna funzione</li>
              <li>Le opinioni modificabili possono essere aggiornate dall'utente; eventuali limiti e scadenze sono indicati nella relativa sezione</li>
              <li>Per evitare duplicazioni e consentire modifiche e cancellazioni, alcune scelte sono collegate tecnicamente all'account dell'utente</li>
              <li>Le statistiche e i risultati sono consultabili in forma aggregata quando previsti, secondo la Privacy Policy</li>
              <li>Le votazioni istituzionali mostrate a scopo informativo sono distinte dalle scelte espresse dagli utenti di Demos</li>
            </ul>

            <h3 className="text-xl font-medium mb-2">7.2 Validità dei Voti</h3>
            <p className="text-gray-700 mb-3">
              I voti espressi su Demos hanno valore consultivo e non sostituiscono 
              i processi elettorali ufficiali. La piattaforma è uno strumento di 
              democrazia partecipativa complementare alle istituzioni democratiche.
            </p>
          </section>

          {/* Privacy e dati */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">8. Privacy e Protezione Dati</h2>
            <p className="text-gray-700 mb-3">
              Il trattamento dei dati personali è regolato dalla nostra{" "}
              <a href="/privacy-policy" className="text-blue-600 hover:text-blue-800 underline">
                Privacy Policy
              </a>. 
              Le finalità, le basi giuridiche, i tempi di conservazione e i diritti
              sono descritti in tale informativa. I consensi necessari, inclusi quelli
              per le opinioni politiche, sono richiesti separatamente quando applicabile.
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>I dati politici richiedono consenso esplicito</li>
              <li>Le scelte possono essere collegate all'account per finalità funzionali; eventuali statistiche pubbliche sono presentate in forma aggregata secondo l'informativa</li>
              <li>Le opinioni pubbliche possono essere visibili ad altri utenti</li>
              <li>I dati sono protetti con misure di sicurezza appropriate</li>
            </ul>

            <h3 className="text-xl font-medium mb-2 mt-4">8.1 Utilizzo di Statistiche Aggregate o Anonimizzate per Ricerca e Analisi</h3>
            <p className="text-gray-700 mb-3">
              Nei limiti indicati dalla Privacy Policy e secondo la base giuridica applicabile,
              Demos può produrre analisi e statistiche con dati aggregati o effettivamente
              anonimizzati, anche a partire da opinioni e scelte degli utenti, per:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>La realizzazione di grafici, statistiche e analisi demografiche</li>
              <li>La pubblicazione di studi e ricerche sull'opinione pubblica</li>
              <li>L'utilizzo nell'ambito del progetto Demos per ricerca, divulgazione
                  e analisi civiche</li>
              <li>La condivisione di dati aggregati con istituzioni, ricercatori e organizzazioni 
                  per finalità di ricerca e analisi</li>
              <li>La pubblicazione e condivisione di dati aggregati e statistiche sui social media 
                  e altre piattaforme digitali per finalità di divulgazione e promozione della 
                  partecipazione democratica, sempre in forma anonima e aggregata</li>
            </ul>
            <p className="text-gray-700 mb-3">
              La diffusione di risultati statistici deve prevedere misure per ridurre il rischio
              di identificazione degli interessati, anche in gruppi numericamente piccoli.
              Non è autorizzato un uso indiscriminato dei dati personali: si applicano
              sempre le finalità, le condizioni e i diritti descritti nella Privacy Policy.
            </p>
            
            <h4 className="text-lg font-medium mb-2 mt-4">8.1.1 Pubblicazione sui Social Media</h4>
            <p className="text-gray-700 mb-3">
              Demos può diffondere sui propri canali social media risultati statistici
              opportunamente aggregati o resi anonimi, nel rispetto delle condizioni
              indicate nella Privacy Policy e degli eventuali consensi necessari, per finalità di:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Divulgazione dei risultati dei sondaggi e delle votazioni</li>
              <li>Promozione della partecipazione democratica e della trasparenza</li>
              <li>Incremento della consapevolezza sui temi trattati dalla piattaforma</li>
              <li>Comunicazione pubblica dell'opinione aggregata degli utenti</li>
            </ul>
            <p className="text-gray-700 mb-3">
              Queste pubblicazioni possono contenere percentuali, totali e altre misure
              aggregate anche per area geografica, solo con cautele adeguate alla
              dimensione del campione e al rischio di identificazione. Non vengono
              pubblicate intenzionalmente scelte identificabili di singoli utenti
              in questo contesto.
            </p>
          </section>

          {/* Proprietà intellettuale */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">9. Proprietà Intellettuale</h2>
            <h3 className="text-xl font-medium mb-2">9.1 Contenuti Demos</h3>
            <p className="text-gray-700 mb-3">
              I contenuti della piattaforma (software, design, testi, immagini) sono
              tutelati dai diritti dei rispettivi titolari, salvo ove siano soggetti
              a licenze o condizioni d'uso differenti.
            </p>

            <h3 className="text-xl font-medium mb-2">9.2 Contenuti Utente</h3>
            <p className="text-gray-700 mb-3">
              L'utente mantiene la proprietà dei propri contenuti ma concede a Demos 
              una licenza non esclusiva per utilizzarli nell'ambito della piattaforma.
            </p>

            <h3 className="text-xl font-medium mb-2 mt-4">9.3 Collegamenti a Siti Esterni</h3>
            <p className="text-gray-700 mb-3">
              La piattaforma può contenere collegamenti a siti web di terze parti che non sono 
              sotto il controllo di Demos. L'inclusione di tali collegamenti non implica:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Approvazione o associazione di Demos con tali siti</li>
              <li>Responsabilità di Demos per i contenuti, le politiche sulla privacy o le 
                  pratiche di tali siti esterni</li>
              <li>Garanzia sulla disponibilità, accuratezza o sicurezza dei siti collegati</li>
            </ul>
            <p className="text-gray-700 mb-3">
              L'utente riconosce e accetta che:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>L'accesso a siti esterni tramite collegamenti presenti sulla piattaforma 
                  avviene a proprio rischio</li>
              <li>Demos non è responsabile per eventuali danni o perdite derivanti dall'uso 
                  di siti esterni</li>
              <li>È responsabilità dell'utente leggere e comprendere i termini di servizio e 
                  le politiche sulla privacy dei siti esterni prima di utilizzarli</li>
            </ul>
            <p className="text-gray-700 mb-3">
              Demos si riserva il diritto di rimuovere qualsiasi collegamento a siti esterni 
              in qualsiasi momento senza preavviso.
            </p>
          </section>

          {/* Responsabilità */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">10. Limitazioni di Responsabilità</h2>
            <p className="text-gray-700 mb-3">
              Demos cerca di garantire la disponibilità e l'affidabilità dei servizi,
              senza poter escludere interruzioni, errori o indisponibilità temporanee.
              Le informazioni pubblicate, comprese quelle politiche o istituzionali,
              hanno finalità informative e non sostituiscono le fonti ufficiali.
            </p>
            <p className="text-gray-700 mb-3">
              Restano ferme le responsabilità previste dalla legge e i diritti
              inderogabili degli utenti. Nessuna disposizione dei presenti termini
              esclude o limita responsabilità che non possono essere escluse per legge.
            </p>
          </section>

          {/* Sospensione account */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">11. Sospensione e Chiusura Account</h2>
            <h3 className="text-xl font-medium mb-2">11.1 Sospensione</h3>
            <p className="text-gray-700 mb-3">
              Demos può sospendere o chiudere account che:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Violano questi termini</li>
              <li>Pubblicano contenuti inappropriati</li>
              <li>Utilizzano la piattaforma per scopi illegali</li>
              <li>Interferiscono con il funzionamento del sistema</li>
              <li>Forniscono informazioni false</li>
            </ul>

            <h3 className="text-xl font-medium mb-2">11.2 Chiusura Volontaria</h3>
            <p className="text-gray-700">
              L'utente può chiudere il proprio account in qualsiasi momento. 
              I dati saranno cancellati secondo la Privacy Policy.
            </p>
          </section>

          {/* Modifiche */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">12. Modifiche ai Termini</h2>
            <p className="text-gray-700">
              Demos può aggiornare questi termini per esigenze organizzative, tecniche o
              normative, comunicando le modifiche significative con modalità adeguate.
              Quando necessario sarà richiesta una nuova accettazione. La sola
              prosecuzione dell'uso non sostituisce gli eventuali consensi previsti dalla legge.
            </p>
          </section>

          {/* Legge applicabile */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">13. Legge Applicabile e Foro</h2>
            <p className="text-gray-700 mb-3">
              Questi termini sono regolati dalla legge italiana, fatti salvi i diritti
              inderogabili riconosciuti dalle norme applicabili. Per le controversie
              la competenza è determinata dalla legge, incluso il foro del consumatore
              ove previsto.
            </p>
          </section>

          {/* Accessibilità */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">14. Accessibilità</h2>
            <p className="text-gray-700 mb-3">
              Demos si impegna a migliorare l'accessibilità del sito e delle applicazioni
              per tutti gli utenti, incluse le persone con disabilità, nel rispetto
              degli obblighi applicabili.
            </p>
            <p className="text-gray-700 mb-3">
              Stiamo lavorando per raggiungere la piena conformità con le linee guida 
              <strong> WCAG 2.1 Livello AA</strong> (Web Content Accessibility Guidelines).
            </p>
            <p className="text-gray-700 mb-3">
              Se riscontri problemi di accessibilità o hai suggerimenti per migliorare l'accessibilità 
              della piattaforma, puoi contattarci all'indirizzo{' '}
              <strong>accessibilita@demos.community</strong>.
            </p>
            <p className="text-gray-700">
              Per maggiori informazioni, consulta la nostra{' '}
              <a href="/accessibilita" className="text-blue-600 hover:text-blue-800 underline">
                Dichiarazione di Accessibilità
              </a>.
            </p>
          </section>

          {/* Contatti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">15. Contatti</h2>
            <p className="text-gray-700 mb-3">
              Per domande sui termini di servizio:
            </p>
            <ul className="list-none text-gray-700">
              <li><strong>Email:</strong> legal@demos.community</li>
              <li><strong>Privacy:</strong> privacy@demos.community</li>
              <li><strong>Accessibilità:</strong> accessibilita@demos.community</li>
            </ul>
          </section>

          {/* Footer */}
          <div className="border-t pt-6 mt-8">
            <p className="text-sm text-gray-500 text-center">
              Versione dei termini: {TERMS_VERSION}. Le modifiche diventano efficaci
              quando pubblicate e comunicate secondo quanto previsto dalla sezione 12.
            </p>
          </div>

        </CardContent>
      </Card>
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="mx-auto max-w-4xl">
          <Button
            variant="default"
            onClick={() => navigate(from || "/registrazione-consensi-termini")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md"
          >
            ← Torna alla registrazione
          </Button>
        </div>
      </div>
    </div>
  );
}
