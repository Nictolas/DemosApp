import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsOfService() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pt-20">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center mb-4">
            Termini e Condizioni d'Uso
          </CardTitle>
          <p className="text-center text-gray-600">
            <strong>Demos</strong> - Ultima modifica: {new Date().toLocaleDateString('it-IT')}
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
              <li><strong>"Contenuto"</strong> - Opinionii, voti, comunicazioni pubblicate</li>
              <li><strong>"Servizi"</strong> - Funzionalità di voto, opinioni, rappresentanza</li>
              <li><strong>"Account"</strong> - Profilo utente registrato</li>
            </ul>
          </section>

          {/* Accettazione */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Accettazione dei Termini</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Accedendo e utilizzando Demos, dichiari di:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Avere almeno 18 anni di età</li>
              <li>Essere cittadino italiano o residente in Italia</li>
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
              <li><strong>Sistema di Voto:</strong> Votazione per capo di stato, referendum, iniziative</li>
              <li><strong>Rappresentanza:</strong> Collegamento con rappresentanti politici</li>
              <li><strong>Iniziative Popolari:</strong> Proposta e sostegno di iniziative</li>
              <li><strong>Comunicazione:</strong> Scambio di informazioni con rappresentanti</li>
              <li><strong>Trasparenza:</strong> Accesso a dati e statistiche pubbliche</li>
            </ul>
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
              <li>Siano veritieri e accurati</li>
              <li>Non violino diritti di terzi</li>
              <li>Non contengano materiale offensivo o illegale</li>
              <li>Rispettino la dignità umana</li>
              <li>Siano pertinenti al contesto democratico</li>
            </ul>

            <h3 className="text-xl font-medium mb-2 mt-4">5.3 Contenuti Generati dagli Utenti</h3>
            <p className="text-gray-700 mb-3">
              L'utente è l'unico responsabile dei contenuti che pubblica sulla piattaforma, 
              inclusi ma non limitati a opinioni, commenti, comunicazioni e proposte. 
              Demos non assume alcuna responsabilità per:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>L'accuratezza, completezza o veridicità dei contenuti pubblicati dagli utenti</li>
              <li>Le opinioni espresse dagli utenti</li>
              <li>Le conseguenze derivanti dall'uso o dalla diffusione di tali contenuti</li>
              <li>Violazioni di diritti di terze parti causate da contenuti pubblicati dagli utenti</li>
            </ul>
            <p className="text-gray-700 mb-3">
              Demos si riserva il diritto, ma non l'obbligo, di:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Moderare, modificare o rimuovere qualsiasi contenuto che violi questi termini</li>
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
              L'utente concede a Demos una licenza non esclusiva, gratuita e perpetua 
              per utilizzare, riprodurre, modificare e distribuire i contenuti pubblicati 
              sulla piattaforma, sempre nel rispetto della Privacy Policy e della normativa 
              sulla protezione dei dati personali.
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
              <li>Utenti che propongono iniziative o referendum</li>
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
            <h2 className="text-2xl font-semibold mb-3">6. Accuratezza delle Opinioni dei Rappresentanti Politici</h2>
            <p className="text-gray-700 mb-3">
              Demos si impegna a fornire informazioni accurate e aggiornate sui rappresentanti 
              politici e le loro opinioni. Tuttavia, l'utente riconosce e accetta che:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Le opinioni e le posizioni dei rappresentanti politici pubblicate sulla piattaforma 
                  potrebbero contenere errori o imprecisioni</li>
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
              <li>Ogni utente può votare una sola volta per ogni consultazione</li>
              <li>I voti sono anonimi e non tracciabili</li>
              <li>I risultati sono pubblici e trasparenti</li>
              <li>Le votazioni hanno scadenze definite</li>
              <li>Non è possibile modificare il voto dopo l'invio</li>
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
              L'utente accetta il trattamento dei dati secondo quanto specificato.
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>I dati politici richiedono consenso esplicito</li>
              <li>I voti sono anonimi e aggregati</li>
              <li>Le opinioni pubbliche possono essere visibili ad altri utenti</li>
              <li>I dati sono protetti con misure di sicurezza appropriate</li>
            </ul>

            <h3 className="text-xl font-medium mb-2 mt-4">8.1 Utilizzo Anonimo dei Dati per Ricerca e Analisi</h3>
            <p className="text-gray-700 mb-3">
              L'utente accetta e consente espressamente che le opinioni, i voti e gli altri dati 
              forniti sulla piattaforma possano essere utilizzati in forma anonima e aggregata per:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>La realizzazione di grafici, statistiche e analisi demografiche</li>
              <li>La pubblicazione di studi e ricerche sull'opinione pubblica</li>
              <li>L'utilizzo da parte dell'Istituto Demos per scopi di ricerca, divulgazione 
                  scientifica e analisi politiche</li>
              <li>La condivisione di dati aggregati con istituzioni, ricercatori e organizzazioni 
                  per finalità di ricerca e analisi</li>
            </ul>
            <p className="text-gray-700 mb-3">
              I dati utilizzati per questi scopi saranno sempre anonimizzati e aggregati, in modo 
              tale che non sia possibile risalire all'identità dei singoli utenti. L'Istituto Demos 
              si riserva il diritto di utilizzare questi dati aggregati e anonimi come meglio crede, 
              nel rispetto della normativa sulla privacy applicabile.
            </p>
          </section>

          {/* Proprietà intellettuale */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">9. Proprietà Intellettuale</h2>
            <h3 className="text-xl font-medium mb-2">9.1 Contenuti Demos</h3>
            <p className="text-gray-700 mb-3">
              Tutti i contenuti della piattaforma (software, design, testi, immagini) 
              sono di proprietà di Demos e protetti da copyright.
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
              Demos non è responsabile per:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Interruzioni temporanee del servizio</li>
              <li>Perdita di dati dovuta a cause tecniche</li>
              <li>Contenuti pubblicati da altri utenti</li>
              <li>Decisioni politiche basate sui risultati della piattaforma</li>
              <li>Danni indiretti o consequenziali</li>
            </ul>
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
              Demos si riserva il diritto di modificare questi termini. 
              Le modifiche significative saranno comunicate agli utenti. 
              L'uso continuato della piattaforma costituisce accettazione delle modifiche.
            </p>
          </section>

          {/* Legge applicabile */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">13. Legge Applicabile e Foro</h2>
            <p className="text-gray-700 mb-3">
              Questi termini sono regolati dalla legge italiana. 
              Per qualsiasi controversia è competente il Foro di Roma.
            </p>
          </section>

          {/* Contatti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">14. Contatti</h2>
            <p className="text-gray-700 mb-3">
              Per domande sui termini di servizio:
            </p>
            <ul className="list-none text-gray-700">
              <li><strong>Email:</strong> legal@demos.community</li>
              <li><strong>Privacy:</strong> privacy@demos.community</li>
            </ul>
          </section>

          {/* Footer */}
          <div className="border-t pt-6 mt-8">
            <p className="text-sm text-gray-500 text-center">
              Questi termini sono efficivi dal {new Date().toLocaleDateString('it-IT')} 
              e sostituiscono eventuali accordi precedenti.
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
