import React from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicy() {
  const [, navigate] = useLocation();
  const from = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('from') : null;

  return (
    <div className={`container mx-auto px-4 py-8 max-w-4xl pt-20 ${from ? 'pb-28' : 'pb-28'}`}>
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center mb-4">
            Informativa sulla Privacy
          </CardTitle>
          <p className="text-center text-gray-600">
            <strong>DemosApp</strong> - Ultima modifica del testo: 08/11/2026
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
              <li><strong>Dati anagrafici:</strong> Anno di nascita e sesso; nome e cognome non sono richiesti agli utenti ordinari, ma possono essere trattati per candidati e rappresentanti quando pertinenti</li>
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
              <li><strong>Pubblicazione dati aggregati:</strong> Pubblicazione di dati aggregati e anonimi sui social media 
                  e altre piattaforme digitali per divulgare i risultati dei sondaggi e promuovere la partecipazione democratica</li>
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
            
            <h3 id="4.1" className="scroll-mt-24 text-xl font-medium mb-2 mt-4">4.1 Trattamento di Dati Particolari - Opinioni Politiche (GDPR Art. 9)</h3>
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
              <li>In caso di revoca, il servizio avvia la cancellazione dei dati politici generati dall'utente nei sistemi attivi. La copia cifrata sul dispositivo viene eliminata quando l'app rileva la revoca; eventuali copie di sicurezza richiedono procedure distinte.</li>
              <li>Il consenso viene registrato con data, ora, indirizzo IP e user agent per finalità di audit e conformità</li>
            </ul>
            <p className="text-gray-700 mb-3">
              <strong>Finalità del trattamento:</strong> Le opinioni politiche vengono utilizzate esclusivamente per:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Permettere l'espressione della tua opinione su temi politici</li>
              <li>Generare statistiche aggregate e anonime sull'opinione pubblica</li>
              <li>Confrontare le tue opinioni con quelle dei rappresentanti politici</li>
              <li>Mostrare, soltanto su tua richiesta nella pagina personale del Compasso politico, indicatori esplorativi dei tuoi orientamenti ricavati dalle Opinioni già espresse</li>
              <li>Migliorare la piattaforma di democrazia partecipativa</li>
              <li>Condividere statistiche aggregate e anonime con giornalisti, ricercatori e organizzazioni per ricerca, analisi e informazione pubblica (solo dati aggregati, non identificabili)</li>
            </ul>
            <p className="text-gray-700 mb-3">
              <strong>Condivisione dati aggregati:</strong> Le statistiche aggregate e anonime (non identificabili) 
              possono essere condivise con giornalisti, ricercatori e organizzazioni per ricerca, analisi e 
              informazione pubblica. I dati individuali non vengono mai condivisi.
            </p>
            <p className="text-gray-700">
              <strong>Nessuna profilazione commerciale o vendita dei dati individuali:</strong> Le tue opinioni politiche individuali 
              non vengono utilizzate per creare profili utente per scopi commerciali, non vengono vendute o condivise 
              con partiti politici, e non vengono utilizzate per targeting pubblicitario politico. Solo statistiche 
              aggregate e anonime (non identificabili) possono essere condivise con giornalisti, ricercatori e organizzazioni.
            </p>
          </section>

          {/* Indicazioni specifiche sulle inferenze politiche locali */}
          <section aria-labelledby="compasso-privacy-heading">
            <h2 id="compasso-privacy-heading" className="text-2xl font-semibold mb-3">
              4.2 Compasso politico e indicatori tematici
            </h2>
            <p className="text-gray-700 mb-3">
              Se scegli di aprire la pagina personale del Compasso politico e il consenso
              alle Opinioni politiche è valido, DEMOS utilizza un sottoinsieme delle risposte
              già fornite per stimare la tua posizione su due dimensioni e mostrare cinque
              indicatori tematici: economia, Stato, costumi, ambiente e immigrazione.
              I risultati sono inferenze sulle opinioni politiche e possono costituire
              profilazione ai sensi del GDPR, anche se il calcolo viene effettuato
              sul tuo dispositivo.
            </p>
            <p className="text-gray-700 mb-3">
              Il calcolo viene eseguito nel browser o nell'app sul dispositivo, al momento
              della visualizzazione, senza salvare i punteggi nel database, inviarli al server
              o renderli pubblici sul profilo. Non vengono aggiunte nuove domande obbligatorie,
              né raccolta l'appartenenza religiosa. Le Opinioni di partenza mantengono invece
              il trattamento e la conservazione già descritti in questa informativa.
            </p>
            <p className="text-gray-700 mb-3">
              Il Compasso e le cinque barre sono strumenti esplorativi e non scientificamente
              validati: non identificano con certezza un'ideologia e non vengono utilizzati
              per decisioni automatizzate con effetti giuridici o analogamente significativi,
              né per pubblicità politica personalizzata. Se mancano risposte sufficienti,
              può comparire «Dati insufficienti» al posto di un punteggio.
            </p>
            <p className="text-gray-700">
              L'uso della pagina è facoltativo. Senza consenso alle Opinioni politiche
              attivo il Compasso non mostra risultati; puoi revocare il consenso con le
              modalità descritte sopra. Le percentuali rappresentano un punteggio
              trasformato delle risposte selezionate, non probabilità né dati
              rappresentativi della popolazione.
            </p>
          </section>

          {/* Conservazione */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Conservazione dei Dati (Data Retention)</h2>
            <p className="text-gray-700 mb-3">
              Rispettiamo il principio di limitazione della conservazione (GDPR Art. 5.1.e). 
              I dati vengono conservati solo per il tempo necessario alle finalità per cui sono stati raccolti, 
              salvo obblighi di legge che richiedono periodi più lunghi.
            </p>
            
            <h3 className="text-xl font-medium mb-2 mt-4">Copia locale del Profilo sul dispositivo</h3>
            <p className="text-gray-700 mb-3">
              Per evitare richieste ripetute al database, il Profilo conserva sul dispositivo
              una copia dei dati anagrafici e delle preferenze già caricate. Le scelte politiche
              sono conservate in un archivio locale cifrato, distinto per account. Questa copia
              non ha una scadenza temporale automatica: viene aggiornata quando salvi modifiche
              o sincronizzi il profilo, e viene eliminata al logout, alla cancellazione
              dell'account, al rifiuto della sessione o alla revoca del consenso rilevata dall'app.
              Una modifica o una revoca eseguita da un altro dispositivo è riconosciuta alla
              successiva verifica della sessione, per cui un dispositivo offline potrebbe
              conservare temporaneamente una copia cifrata non ancora aggiornata.
              Il browser o il sistema operativo possono inoltre cancellare autonomamente
              i dati locali. Questa conservazione sul dispositivo è distinta da quella sui server.
            </p>

            <h3 className="text-xl font-medium mb-2 mt-4">5.1 Periodi di Conservazione per Tipo di Dato</h3>
            <p className="text-gray-700 mb-3">
              I seguenti periodi di conservazione si applicano ai tuoi dati personali:
            </p>
            
            <div className="space-y-4 mb-4">
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <h4 className="font-semibold text-gray-800 mb-2">📋 Dati del Profilo Utente</h4>
                <p className="text-gray-700 mb-2">
                  <strong>Criterio:</strong> Per il tempo necessario a mantenere l'account e fino alla sua cancellazione, salvo dati specifici soggetti a obblighi di legge documentati.
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Dati inclusi:</strong> Nome, cognome, email, anno di nascita, cittadinanza, 
                  dati di residenza, dati di elezione e candidatura
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Motivo:</strong> Erogazione del servizio. Le scritture contabili, se presenti, sono trattate separatamente; l'art. 2220 c.c. non giustifica la conservazione generalizzata dei profili.
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                <h4 className="font-semibold text-gray-800 mb-2">🗳️ Voti e Opinioni Politiche</h4>
                <p className="text-gray-700 mb-2">
                  <strong>Criterio:</strong> Per il tempo necessario alle funzionalità richieste e finché rimane valido il consenso esplicito per i dati politici. Alla revoca, il servizio avvia la cancellazione dei dati politici generati dall'utente.
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Dati inclusi:</strong> Voti per capo di stato, referendum, iniziative popolari, 
                  ICE, opinioni politiche su temi specifici
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Motivo:</strong> Partecipazione democratica e statistiche. Non si applica automaticamente ai dati politici il termine previsto dall'art. 2220 c.c. per le scritture contabili.
                </p>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                <h4 className="font-semibold text-gray-800 mb-2">🔐 Dati di Autenticazione</h4>
                <p className="text-gray-700 mb-2">
                  <strong>Periodo:</strong> 1 anno (365 giorni) dall'ultimo accesso
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Dati inclusi:</strong> Hash della password, ultimo accesso, tentativi di login
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Motivo:</strong> Sicurezza e prevenzione frodi
                </p>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
                <h4 className="font-semibold text-gray-800 mb-2">📊 Log di Audit e Sicurezza</h4>
                <p className="text-gray-700 mb-2">
                  <strong>Criterio:</strong> Secondo la finalità specifica di sicurezza o accountability, con un periodo motivato, limitato e distinto per categoria di log; nessun termine generale di sette anni è imposto dal GDPR.
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Dati inclusi:</strong> Azioni di audit, eventi di sicurezza, accessi al sistema, 
                  modifiche ai dati, indirizzi IP (anonimizzati)
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Motivo:</strong> Sicurezza, conformità normativa e dimostrazione della conformità GDPR
                </p>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
                <h4 className="font-semibold text-gray-800 mb-2">💬 Dati di Supporto</h4>
                <p className="text-gray-700 mb-2">
                  <strong>Periodo:</strong> 3 anni (1.095 giorni) dall'ultima interazione
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Dati inclusi:</strong> Ticket di supporto, messaggi, note di risoluzione
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Motivo:</strong> Supporto clienti e miglioramento della qualità del servizio
                </p>
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-500">
                <h4 className="font-semibold text-gray-800 mb-2">📈 Dati di Analytics</h4>
                <p className="text-gray-700 mb-2">
                  <strong>Periodo:</strong> 2 anni (730 giorni) dalla data di raccolta
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Dati inclusi:</strong> Visualizzazioni di pagina, eventi di click, comportamento utente (anonimizzato)
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Motivo:</strong> Analytics e miglioramento del servizio
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-gray-500">
                <h4 className="font-semibold text-gray-800 mb-2">🔑 Dati di Sessione</h4>
                <p className="text-gray-700 mb-2">
                  <strong>Periodo:</strong> 30 giorni dall'ultima attività
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Dati inclusi:</strong> Token di sessione, refresh token, dati di sessione
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Motivo:</strong> Sicurezza e privacy
                </p>
              </div>
            </div>

            <h3 className="text-xl font-medium mb-2 mt-6">5.2 Meccanismo di Cancellazione</h3>
            <p className="text-gray-700 mb-3">
              La cancellazione dei dati è soggetta alle finalità, alla base giuridica e agli effettivi meccanismi di cancellazione applicabili:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>I dati non più necessari devono essere cancellati o resi irreversibilmente anonimi. I tempi operativi e i processi per ciascuna categoria devono essere verificati e documentati.</li>
              <li>Il consenso ai dati politici può essere revocato in qualsiasi momento e la richiesta comporta la rimozione dei dati personali trattati esclusivamente sulla base di tale consenso.</li>
              <li>Le copie tecniche e di backup seguono procedure di cancellazione e accesso distinte, da verificare nell'ambito delle misure di protezione.</li>
              <li>Per la cancellazione dei dati personali si applicano l'art. 17 GDPR e le eventuali eccezioni previste dalla legge.</li>
            </ul>

            <h3 className="text-xl font-medium mb-2 mt-6">5.3 Diritto di Estensione</h3>
            <p className="text-gray-700 mb-3">
              Puoi richiedere di estendere il periodo di conservazione dei tuoi dati per motivi legittimi 
              (es. procedimenti legali in corso, obblighi contrattuali). Per richiedere un'estensione, 
              contattaci all'indirizzo <strong>privacy@demos.community</strong>.
            </p>

            <h3 className="text-xl font-medium mb-2 mt-6">5.4 Cancellazione Anticipata</h3>
            <p className="text-gray-700 mb-3">
              Puoi richiedere la cancellazione anticipata dei tuoi dati in qualsiasi momento esercitando 
              il tuo diritto alla cancellazione (GDPR Art. 17). Per maggiori informazioni, consulta la 
              sezione <strong>"Diritti dell'Interessato"</strong> di questa Privacy Policy.
            </p>

            <h3 id="eliminazione-account" className="text-xl font-medium mb-2 mt-6">5.5 Come richiedere l'eliminazione dell'account (DemosApp)</h3>
            <p className="text-gray-700 mb-3">
              Se utilizzi l'app <strong>DemosApp</strong> (gestita nell'ambito del progetto DEMOS) e desideri eliminare il tuo account e i dati associati, puoi farlo nel seguente modo.
            </p>
            <p className="text-gray-700 font-medium mb-2">Passaggi per richiedere l'eliminazione:</p>
            <ol className="list-decimal pl-6 mb-4 text-gray-700 space-y-2">
              <li>Accedi all'app DemosApp con le tue credenziali (email e password).</li>
              <li>Vai in <strong>Impostazioni</strong> (icona ingranaggio) e seleziona <strong>Cancella account</strong>.</li>
              <li>Segui le istruzioni a schermo: puoi prima scaricare una copia dei tuoi dati (Scarica i tuoi dati), poi confermare la tua identità con la password e confermare di aver compreso che la cancellazione è irreversibile.</li>
              <li>Conferma la cancellazione definitiva. L'account e i dati associati verranno eliminati in modo permanente.</li>
              <li><strong>Alternativa:</strong> Puoi anche richiedere la cancellazione scrivendo a <strong>privacy@demos.community</strong> indicando l'email dell'account da eliminare; provvederemo entro i termini di legge.</li>
            </ol>
            <p className="text-gray-700 font-medium mb-2">Dati che vengono eliminati:</p>
            <ul className="list-disc pl-6 mb-2 text-gray-700">
              <li>Profilo utente (nome, cognome, email, residenza, cittadinanza, anno di nascita, genere, avatar, preferenze).</li>
              <li>Opinioni politiche e voti espressi (referendum, iniziative, capo stato, ecc.).</li>
              <li>Cronologia attività, notifiche, consensi registrati, token di sessione.</li>
              <li>Accesso all'account: non sarà più possibile accedere con quelle credenziali.</li>
            </ul>
            <p className="text-gray-700 font-medium mb-2">Dati che possono essere conservati (solo se richiesto dalla legge):</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Dati soggetti a obblighi di conservazione fiscale o contabile (es. Art. 2220 Codice Civile) per il periodo previsto dalla legge.</li>
              <li>Dati anonimizzati o aggregati già utilizzati per statistiche, che non consentono l'identificazione della persona.</li>
              <li>Log di audit e sicurezza per il periodo necessario a garantire la sicurezza del servizio e l'adempimento legale.</li>
            </ul>
            <p className="text-gray-700 mb-3">
              La cancellazione è <strong>irreversibile</strong> per i dati personali eliminati. Per ulteriori dettagli sui periodi di conservazione, vedi le sezioni 5.1 e 5.2 di questa informativa.
            </p>

            <div className="bg-blue-50 p-4 rounded-lg mt-4 border-l-4 border-blue-500">
              <p className="text-sm text-gray-700">
                <strong>📌 Nota Importante:</strong> Alcuni dati potrebbero essere conservati oltre i periodi 
                indicati se richiesto da obblighi di legge, ordini giudiziari o per la risoluzione di controversie. 
                In questi casi, ti informeremo tempestivamente.
              </p>
            </div>
          </section>

          {/* Sicurezza */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Misure di Sicurezza</h2>
            <p className="text-gray-700 mb-3">Implementiamo misure tecniche e organizzative per proteggere i tuoi dati:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li><strong>Crittografia:</strong> Dati trasmessi e memorizzati in forma crittografata</li>
              <li><strong>Autenticazione sicura:</strong> Auth.js con token JWT</li>
              <li><strong>Database sicuro:</strong> PostgreSQL su Supabase (Frankfurt, UE — `eu-central-1`) con connessioni SSL</li>
              <li><strong>Accesso limitato:</strong> Solo personale autorizzato può accedere ai dati</li>
              <li><strong>Backup sicuri:</strong> Backup regolari e crittografati</li>
              <li><strong>Monitoraggio:</strong> Log di accesso e monitoraggio delle attività</li>
            </ul>

            <h3 className="text-xl font-medium mb-2 mt-4">6.1 Accesso del personale autorizzato (amministratori) a opinioni e voti</h3>
            <p className="text-gray-700 mb-3">
              Il personale autorizzato (amministratori) può accedere alle <strong>opinioni</strong> e ai <strong>voti</strong> 
              degli utenti solo per le finalità e nei limiti di seguito indicati, nel rispetto del principio di minimizzazione 
              e della base giuridica applicabile.
            </p>
            <p className="text-gray-700 mb-2 font-medium">Per politici, candidati e candidati-politici (ruoli P, C, CP):</p>
            <ul className="list-disc pl-6 mb-3 text-gray-700">
              <li>Gli account di queste categorie possono essere creati dagli amministratori per far funzionare la piattaforma; 
                  le opinioni e i voti associati hanno spesso una <strong>fonte esterna</strong> (documenti, dati ufficiali).</li>
              <li>Gli amministratori possono <strong>vedere e modificare</strong> opinioni e voti per questi ruoli per rendere 
                  più efficace il <strong>matching</strong> (confronto con cittadini ed elettori) e per gestire correttamente i profili.</li>
              <li>Quando il politico o candidato contatta la piattaforma, l’account può essere attribuito a lui (es. cambio email, 
                  password temporanea); da quel momento il titolare del dato è l’interessato.</li>
            </ul>
            <p className="text-gray-700 mb-2 font-medium">Per elettori e altre categorie di utenti (es. ruolo E):</p>
            <ul className="list-disc pl-6 mb-3 text-gray-700">
              <li>Gli amministratori possono accedere a opinioni e voti solo quando <strong>necessario</strong> per: 
                  <strong> supporto</strong> (es. correzione errori su richiesta dell’utente), <strong>moderazione</strong> 
                  (contenuti illeciti o abuso), <strong>sicurezza e prevenzione frodi</strong>, <strong>esercizio dei diritti 
                  dell’interessato</strong> (accesso, rettifica, cancellazione) e <strong>adempimento di obblighi di legge</strong> 
                  (incluse richieste delle autorità competenti).</li>
              <li>Non è consentito l’accesso generico alle opinioni e ai voti per finalità diverse da quelle indicate.</li>
            </ul>
            <p className="text-gray-700 mb-3">
              L’accesso è limitato ai soli ruoli che ne hanno bisogno, è tracciato ove possibile (log/audit) ed è 
              documentato nel registro delle attività di trattamento e nella presente informativa per garantire 
              trasparenza e conformità al GDPR.
            </p>
          </section>

          {/* Condivisione */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">7. Condivisione dei Dati</h2>
            <p className="text-gray-700 mb-3">Non vendiamo i tuoi dati. Li condividiamo solo con:</p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li><strong>Fornitori di servizi:</strong> Supabase (database), Resend (email), Render (hosting)</li>
              <li><strong>Autorità competenti:</strong> Solo se richiesto per legge</li>
              <li><strong>Consenso esplicito:</strong> Per altre finalità con il tuo consenso</li>
            </ul>
          </section>

          {/* Utilizzo dati aggregati per pubblicazione */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">8. Utilizzo di Dati Aggregati per Pubblicazione</h2>
            <p className="text-gray-700 mb-3">
              Quando appropriato, diffondiamo statistiche derivate da opinioni e scelte raccolte
              sulla piattaforma per divulgare risultati e promuovere la partecipazione democratica.
              Il trattamento delle risposte personali sottostanti è distinto dalla pubblicazione
              dei risultati e resta soggetto ai consensi e alle altre condizioni applicabili.
            </p>
            
            <h3 className="text-xl font-medium mb-2">8.1 Pubblicazione sui Social Media</h3>
            <p className="text-gray-700 mb-3">
              Possiamo pubblicare sui canali social e su altre piattaforme dati statistici
              sufficientemente aggregati oppure effettivamente anonimi, con adeguate misure
              di minimizzazione del rischio di identificazione, per:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Divulgare i risultati dei sondaggi e delle votazioni in forma aggregata</li>
              <li>Comunicare pubblicamente l'opinione aggregata degli utenti su temi di interesse</li>
              <li>Promuovere la partecipazione democratica e la trasparenza</li>
              <li>Incrementare la consapevolezza sui temi trattati dalla piattaforma</li>
            </ul>
            
            <h3 className="text-xl font-medium mb-2">8.2 Salvaguardie contro la Reidentificazione</h3>
            <p className="text-gray-700 mb-3">
              Prima di pubblicare statistiche sui social media e sulle altre piattaforme,
              verifichiamo il rischio che dati anche aggregati consentano di identificare
              indirettamente le persone. Le pubblicazioni possono comprendere:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700">
              <li>Statistiche aggregate (percentuali, totali, medie, distribuzioni)</li>
              <li>Risultati effettivamente anonimizzati, quando possibile e verificato</li>
              <li>Statistiche geografiche (nazionali, regionali, provinciali, comunali) solo quando 
                  il campione e gli altri fattori di rischio consentono una diffusione adeguatamente protetta</li>
            </ul>
            <p className="text-gray-700 mb-3">
              <strong>Non includiamo intenzionalmente:</strong> nomi, email, dati anagrafici
              o altre informazioni direttamente identificative nelle statistiche pubblicate.
              I risultati su gruppi piccoli o facilmente riconoscibili non devono essere diffusi
              senza adeguate protezioni.
            </p>
            
            <h3 className="text-xl font-medium mb-2">8.3 Base Giuridica</h3>
            <p className="text-gray-700 mb-3">
              Le opinioni e le scelte politiche riferibili a persone identificabili sono dati
              personali che richiedono una base giuridica valida e una condizione applicabile
              ai sensi dell'art. 9 GDPR, in particolare il consenso esplicito quando previsto.
              Anche le operazioni necessarie a produrre statistiche devono essere lecite.
              I risultati realmente anonimi non costituiscono più dati personali, mentre
              semplici aggregazioni o pseudonimizzazioni non assicurano da sole l'anonimato.
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
              <li>
                <strong>Portabilità (Art. 20):</strong> Ricevere i tuoi dati in formato strutturato, 
                di uso comune e leggibile da dispositivo automatico. Puoi scaricare i tuoi dati direttamente 
                dalla pagina <a href="/gdpr" className="text-blue-600 hover:text-blue-800 underline">Diritti GDPR</a> 
                in formato <strong>JSON</strong> (formato standard, leggibile automaticamente) o <strong>CSV</strong> 
                (formato tabellare, compatibile con Excel e altri software). I dati esportati includono: 
                profilo utente, opinioni politiche, attività di voto nei limiti dei dati personali esportabili, 
                comunicazioni, notifiche, consensi e log di audit. I dati sono esportati conformemente al GDPR Art. 20.1, 
                in formato strutturato e comunemente usato. <strong>Nota:</strong> Il trasferimento diretto dei dati 
                a un altro fornitore di servizi richiede standard tecnici comuni tra i fornitori; attualmente non è 
                tecnicamente possibile senza tali standard.
              </li>
              <li><strong>Opposizione:</strong> Opporti al trattamento per motivi legittimi</li>
              <li><strong>Revoca consenso:</strong> Revocare il consenso in qualsiasi momento</li>
            </ul>
            <p className="text-gray-700 mb-3">
              Per esercitare questi diritti, contattaci all'indirizzo: <strong>privacy@demos.community</strong>
            </p>
            <p className="text-gray-700">
              Per informazioni dettagliate su tutte le attività di trattamento dei dati, consulta il{' '}
              <a href="/registro-trattamenti" className="text-blue-600 hover:text-blue-800 underline">
                Registro delle Attività di Trattamento
              </a> (conforme GDPR Art. 30).
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
              Sul sito web DEMOS, allo stato attuale, non utilizziamo cookie pubblicitari
              di Google AdMob o Google AdSense. I cookie e gli strumenti strettamente necessari
              al funzionamento del servizio sono trattati secondo le norme applicabili.
              L'eventuale pubblicità nativa Android è distinta dai cookie del sito.
            </p>
            <p className="text-gray-700">
              Per maggiori dettagli, consulta la nostra{" "}
              <a href="/cookie-policy" className="text-blue-600 hover:text-blue-800 underline">
                Cookie Policy
              </a>.
            </p>
          </section>

          {/* Preparazione trasparente, non attivazione di nuovi SDK nelle release */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">
              10.1 Pubblicità nell'app Android: integrazione prevista, non ancora attiva
            </h2>
            <p className="text-gray-700 mb-3">
              DEMOS sta predisponendo unicamente annunci di tipo <strong>App Open</strong>
              (all'apertura dell'app Android) tramite Google AdMob. <strong>Nelle versioni
              Android attualmente distribuite questa integrazione pubblicitaria non è
              attiva e gli SDK AdMob e UMP non sono inclusi nella variante di rilascio.</strong>
              L'eventuale attivazione richiederà una nuova versione dell'app, la verifica
              della conformità e l'aggiornamento delle informazioni nello store.
              Non è prevista pubblicità sul sito web.
            </p>
            <p className="text-gray-700 mb-3">
              Se l'integrazione verrà attivata, DEMOS intende richiedere soltanto
              <strong> annunci non personalizzati</strong>. Questo non significa che gli
              annunci siano privi di trattamento di dati personali: Google Mobile Ads
              può raccogliere e condividere dati tecnici per la fornitura degli annunci,
              la misurazione, la diagnostica e la prevenzione delle frodi.
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>
                <strong>Dati tecnici potenzialmente trattati da Google:</strong> indirizzo IP
                (anche per stimare la posizione approssimativa), interazioni con annunci e app,
                informazioni diagnostiche e identificatori del dispositivo o pubblicitari,
                secondo le impostazioni effettive e le condizioni dei servizi.
              </li>
              <li>
                <strong>Nessun trasferimento intenzionale delle scelte civiche:</strong> DEMOS
                non utilizzerà opinioni politiche, voti, firme, affinità politiche, dati del
                profilo o identificativi dell'account per creare segmenti pubblicitari
                o inviarli a Google AdMob. I dati tecnici raccolti autonomamente dagli SDK
                devono comunque essere valutati separatamente.
              </li>
              <li>
                <strong>Fornitori:</strong> Google e, se effettivamente coinvolti, i partner
                pubblicitari indicati nel messaggio di consenso e nel relativo elenco
                aggiornato. L'inclusione nell'elenco non implica che ogni partner riceva
                dati da ogni utente.
              </li>
              <li>
                <strong>Scelte dell'utente:</strong> prima di richiedere annunci laddove
                richiesto verrà presentato il messaggio Google UMP, con le possibilità
                di accettare, negare il consenso o gestire le opzioni. L'eventuale
                interesse legittimo, ove applicabile, resta distinto dal consenso e
                può essere oggetto di opposizione. Le opzioni privacy saranno
                nuovamente accessibili nell'app quando richiesto dalle regole UMP.
                Rifiutare il consenso pubblicitario non impedisce di usare DEMOS.
              </li>
              <li>
                <strong>Informazioni e diritti:</strong> basi giuridiche, periodi di
                conservazione, eventuali trasferimenti extra SEE e impostazioni
                definitive dovranno essere verificati prima dell'attivazione,
                assieme al Registro dei trattamenti e alla dichiarazione
                Sicurezza dei dati di Google Play. Puoi contattare
                <strong> privacy@demos.community</strong> per esercitare i tuoi diritti.
              </li>
            </ul>
            <p className="text-gray-700 mb-3">
              Per ulteriori informazioni sui trattamenti relativi ai servizi
              pubblicitari Google, consulta la{' '}
              <a
                href="https://developers.google.com/admob/android/next-gen/privacy/play-data-disclosure"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                documentazione sui dati trattati da Google Mobile Ads
              </a>
              {' '}e le{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                norme sulla privacy di Google
              </a>.
            </p>
          </section>

          {/* Trasferimenti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">11. Trasferimenti Internazionali</h2>
            <p className="text-gray-700 mb-4">
              I tuoi dati personali sono trattati principalmente all'interno dell'Unione Europea. 
              Quando utilizziamo fornitori di servizi situati in paesi terzi (fuori dall'UE), 
              adottiamo garanzie adeguate per proteggere i tuoi dati secondo il GDPR (Art. 44-49).
            </p>

            <h3 className="text-xl font-medium mb-2 mt-4">11.1 Fornitori di Servizi e Ubicazione Dati</h3>
            <p className="text-gray-700 mb-3">
              Utilizziamo i seguenti fornitori di servizi per il funzionamento della piattaforma:
            </p>

            <div className="space-y-4 mb-4">
              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                <h4 className="font-semibold text-gray-800 mb-2">💾 Supabase (Database PostgreSQL)</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li><strong>Servizio:</strong> Database principale per tutti i dati utente</li>
                  <li><strong>Ubicazione:</strong> Unione Europea (Francoforte, Germania)</li>
                  <li><strong>Dati trattati:</strong> Tutti i dati personali degli utenti (profilo, opinioni, voti, autenticazione)</li>
                  <li><strong>Garanzie:</strong> Server situati in UE, conforme GDPR</li>
                  <li><strong>Policy Privacy:</strong> <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">https://supabase.com/privacy</a></li>
                </ul>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <h4 className="font-semibold text-gray-800 mb-2">📧 Resend (Servizio Email)</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li><strong>Servizio:</strong> Invio email di verifica, reset password e notifiche</li>
                  <li><strong>Ubicazione:</strong> Stati Uniti d'America (con possibili server in UE)</li>
                  <li><strong>Dati trattati:</strong> Indirizzi email, contenuti delle email inviate</li>
                  <li><strong>Garanzie:</strong> Standard Contractual Clauses (SCC) approvate dalla Commissione Europea</li>
                  <li><strong>Policy Privacy:</strong> <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">https://resend.com/legal/privacy-policy</a></li>
                </ul>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
                <h4 className="font-semibold text-gray-800 mb-2">☁️ Render (Hosting Frontend e Backend)</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li><strong>Servizio:</strong> Hosting dell'applicazione web (frontend e backend API)</li>
                  <li><strong>Ubicazione:</strong> Stati Uniti d'America (con possibili regioni in UE)</li>
                  <li><strong>Dati trattati:</strong> Dati temporanei di elaborazione, log di sistema, indirizzi IP</li>
                  <li><strong>Garanzie:</strong> Standard Contractual Clauses (SCC) approvate dalla Commissione Europea</li>
                  <li><strong>Policy Privacy:</strong> <a href="https://render.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">https://render.com/privacy</a></li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-medium mb-2 mt-6">11.2 Garanzie Adeguate per Trasferimenti verso Paesi Terzi</h3>
            <p className="text-gray-700 mb-3">
              Per i trasferimenti di dati verso paesi terzi (fuori dall'UE), utilizziamo le seguenti garanzie adeguate:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>
                <strong>Standard Contractual Clauses (SCC):</strong> Clausole contrattuali standard approvate 
                dalla Commissione Europea (Decisione 2021/914/UE) che garantiscono un livello di protezione 
                dei dati equivalente a quello dell'UE.
              </li>
              <li>
                <strong>Valutazione del rischio:</strong> Prima di trasferire dati, valutiamo il livello di 
                protezione offerto dal paese terzo e adottiamo misure supplementari se necessario.
              </li>
              <li>
                <strong>Monitoraggio continuo:</strong> Monitoriamo regolarmente la conformità dei nostri 
                fornitori alle garanzie adottate.
              </li>
            </ul>

            <h3 className="text-xl font-medium mb-2 mt-6">11.3 I Tuoi Diritti</h3>
            <p className="text-gray-700 mb-3">
              Hai il diritto di:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Essere informato sui trasferimenti internazionali dei tuoi dati</li>
              <li>Richiedere una copia delle garanzie adeguate adottate</li>
              <li>Opporti a trasferimenti specifici (salvo obblighi di legge)</li>
              <li>Esercitare i tuoi diritti GDPR anche in caso di trasferimenti internazionali</li>
            </ul>

            <h3 className="text-xl font-medium mb-2 mt-6">11.4 Contatti</h3>
            <p className="text-gray-700 mb-3">
              Per maggiori informazioni sui trasferimenti internazionali o per richiedere una copia delle 
              garanzie adeguate, contattaci all'indirizzo <strong>privacy@demos.community</strong>.
            </p>

            <div className="bg-blue-50 p-4 rounded-lg mt-4 border-l-4 border-blue-500">
              <p className="text-sm text-gray-700">
                <strong>📌 Nota Importante:</strong> I trasferimenti internazionali sono limitati al minimo 
                necessario per il funzionamento della piattaforma. La maggior parte dei tuoi dati (database) 
                è memorizzata in UE (Supabase — Francoforte, `eu-central-1`). I trasferimenti verso paesi terzi riguardano 
                principalmente servizi di hosting e email, e sono sempre protetti da garanzie adeguate.
              </p>
            </div>
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
              <li><strong>Titolare del trattamento:</strong> Nicolas Micheletti (progetto DEMOS)</li>
              <li><strong>Autorità di controllo:</strong> Garante per la Protezione dei Dati Personali</li>
            </ul>
          </section>

          {/* Footer */}
          <div className="border-t pt-6 mt-8">
            <p className="text-sm text-gray-500 text-center">
              Questa informativa descrive il trattamento dei dati personali ai sensi del Regolamento (UE) 2016/679 (GDPR) 
              e del D.Lgs. 196/2003 (Codice Privacy).
            </p>
          </div>

        </CardContent>
      </Card>
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="mx-auto max-w-4xl">
          <Button
            variant="default"
            onClick={() => navigate(from || "/registrazione-consensi-privacy")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md"
          >
            ← Torna alla registrazione
          </Button>
        </div>
      </div>
    </div>
  );
} 
