import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Database, Users, Globe, Clock, Lock, FileText } from 'lucide-react';
import { Link } from 'wouter';

export default function RegistroTrattamenti() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pt-20">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center mb-4">
            Registro delle Attività di Trattamento
          </CardTitle>
          <p className="text-center text-gray-600">
            <strong>DemosApp</strong> - Registro ai sensi dell'art. 30 GDPR<br />
            Ultima modifica del testo: 30/10/2026
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Introduzione */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Introduzione</h2>
            <p className="text-gray-700 leading-relaxed">
              Questo registro documenta tutte le attività di trattamento dei dati personali effettuate 
              da DemosApp, conformemente all'<strong>Art. 30 del GDPR</strong> (Regolamento Generale sulla 
              Protezione dei Dati). Il registro è disponibile all'autorità di controllo su richiesta e 
              viene aggiornato regolarmente.
            </p>
          </section>

          {/* Trattamento 1: Gestione Account Utenti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Trattamento 1: Gestione Account Utenti</h2>
            
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  Finalità del Trattamento
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Registrazione e gestione account utente</li>
                  <li>Autenticazione e autorizzazione</li>
                  <li>Gestione profilo utente</li>
                  <li>Comunicazione con gli utenti</li>
                </ul>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  Categorie di Interessati
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Utenti registrati della piattaforma</li>
                  <li>Utenti in fase di registrazione</li>
                </ul>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  Categorie di Dati Personali
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Dati anagrafici: nome, cognome, anno di nascita, genere</li>
                  <li>Dati di contatto: indirizzo email</li>
                  <li>Dati di residenza: paese, regione, provincia, comune</li>
                  <li>Dati di cittadinanza: cittadinanza, paese di elezione</li>
                  <li>Dati di autenticazione: password (hash), token di sessione</li>
                  <li>Dati tecnici: indirizzo IP, user agent, timestamp</li>
                </ul>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Globe className="h-5 w-5 text-orange-600" />
                  Destinatari dei Dati
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Personale autorizzato di DemosApp</li>
                  <li>Fornitori di servizi: Supabase (database - UE), Render (hosting - USA con SCC), Resend (email - USA con SCC)</li>
                  <li>Autorità competenti: solo se richiesto per legge</li>
                </ul>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  Termini di Cancellazione
                </h3>
                <p className="text-sm text-gray-700">
                  <strong>Profilo utente:</strong> per il tempo necessario al servizio, fino a cancellazione dell'account, salvo specifici obblighi documentati<br />
                  <strong>Dati autenticazione:</strong> 1 anno dall'ultimo accesso<br />
                  <strong>Dati sessione:</strong> 30 giorni dall'ultima attività
                </p>
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Lock className="h-5 w-5 text-indigo-600" />
                  Misure di Sicurezza
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Crittografia dei dati in transito (SSL/TLS)</li>
                  <li>Hash delle password con bcrypt</li>
                  <li>Autenticazione JWT sicura</li>
                  <li>Accesso limitato al personale autorizzato</li>
                  <li>Backup regolari e crittografati</li>
                  <li>Monitoraggio e audit logging</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Trattamento 2: Opinioni Politiche */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Trattamento 2: Opinioni Politiche (Dati Particolari - GDPR Art. 9)</h2>
            
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  Finalità del Trattamento
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Raccolta e gestione delle opinioni politiche degli utenti</li>
                  <li>Generazione di statistiche aggregate e anonime</li>
                  <li>Confronto tra opinioni utenti e rappresentanti politici</li>
                  <li>Miglioramento della piattaforma di democrazia partecipativa</li>
                </ul>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  Categorie di Interessati
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Utenti che hanno concesso consenso esplicito al trattamento delle opinioni politiche</li>
                </ul>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  Categorie di Dati Personali (Dati Particolari - Art. 9)
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Opinioni politiche su temi specifici (energia nucleare, sperimentazione animale, legalizzazione canapa, caccia, eutanasia, matrimonio gay, salario minimo, ecc.)</li>
                  <li>Consenso esplicito con timestamp, IP e user agent</li>
                </ul>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Globe className="h-5 w-5 text-orange-600" />
                  Destinatari dei Dati
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Personale autorizzato di DemosApp</li>
                  <li>Fornitori di servizi: Supabase (database - UE)</li>
                  <li>Giornalisti e ricercatori: solo dati aggregati e anonimi (non identificabili)</li>
                  <li>Pubblicazione sui social media: solo statistiche aggregate e anonime</li>
                </ul>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  Termini di Cancellazione
                </h3>
                <p className="text-sm text-gray-700">
                  <strong>Opinioni politiche:</strong> fino alla revoca del consenso o alla cancellazione dell'account, secondo le finalità del servizio<br />
                   <strong>In caso di revoca consenso:</strong> il backend avvia la cancellazione dei dati politici prodotti dall'utente e il client elimina la cache cifrata quando rileva la revoca
                </p>
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Lock className="h-5 w-5 text-indigo-600" />
                  Misure di Sicurezza
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Consenso esplicito obbligatorio (GDPR Art. 9.2.a)</li>
                  <li>Crittografia dei dati in transito e a riposo</li>
                  <li>Accesso limitato al personale autorizzato</li>
                  <li>Anonimizzazione per pubblicazione dati aggregati</li>
                  <li>Audit logging di tutte le operazioni</li>
                  <li>Nessuna profilazione o vendita dati individuali</li>
                </ul>
              </div>

              <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                <h3 className="font-semibold text-gray-800 mb-2">
                  Base Giuridica
                </h3>
                <p className="text-sm text-gray-700">
                  <strong>GDPR Art. 9.2.a:</strong> Consenso esplicito dell'interessato. Il consenso è 
                  obbligatorio per la registrazione e può essere revocato in qualsiasi momento.
                </p>
              </div>
            </div>
          </section>

          {/* Trattamento 3: Dati di Voto */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Trattamento 3: Dati di Voto</h2>
            
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  Finalità del Trattamento
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Raccolta e gestione dei voti degli utenti (capo di stato, referendum, iniziative popolari, ICE)</li>
                  <li>Generazione di statistiche aggregate</li>
                  <li>Democrazia partecipativa</li>
                </ul>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  Categorie di Interessati
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Utenti che hanno espresso voti sulla piattaforma</li>
                </ul>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  Categorie di Dati Personali
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Voti per capo di stato</li>
                  <li>Voti per referendum abrogativi</li>
                  <li>Voti per iniziative popolari</li>
                  <li>Voti per ICE (Iniziative Cittadine Europee)</li>
                  <li>Voti per grazia e amnistia</li>
                  <li>Timestamp e metadati associati</li>
                </ul>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  Termini di Cancellazione
                </h3>
                <p className="text-sm text-gray-700">
                  <strong>Dati di voto:</strong> per il tempo necessario alla partecipazione e in presenza della base giuridica applicabile; l'art. 2220 c.c. riguarda le scritture contabili, non i voti politici<br />
                   <strong>In caso di cancellazione account:</strong> i dati personali sono soggetti alle procedure di cancellazione; possono permanere soltanto statistiche irreversibilmente anonime
                </p>
              </div>
            </div>
          </section>

          {/* Trattamento 4: Comunicazioni e Notifiche */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Trattamento 4: Comunicazioni e Notifiche</h2>
            
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  Finalità del Trattamento
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Invio di comunicazioni tra utenti e rappresentanti</li>
                  <li>Invio di notifiche di sistema</li>
                  <li>Supporto clienti</li>
                </ul>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  Categorie di Dati Personali
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Messaggi e comunicazioni</li>
                  <li>Notifiche di sistema</li>
                  <li>Ticket di supporto</li>
                  <li>Metadati: timestamp, mittente, destinatario</li>
                </ul>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  Termini di Cancellazione
                </h3>
                <p className="text-sm text-gray-700">
                  <strong>Dati di supporto:</strong> 3 anni dall'ultima interazione<br />
                  <strong>Notifiche:</strong> 30 giorni dalla lettura
                </p>
              </div>
            </div>
          </section>

          {/* Trattamento 5: Log di Audit e Sicurezza */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Trattamento 5: Log di Audit e Sicurezza</h2>
            
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  Finalità del Trattamento
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Sicurezza del sistema</li>
                  <li>Conformità normativa</li>
                  <li>Prevenzione frodi</li>
                  <li>Dimostrazione conformità GDPR</li>
                </ul>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  Categorie di Dati Personali
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Azioni di audit (login, modifiche dati, esportazioni, cancellazioni)</li>
                  <li>Eventi di sicurezza (tentativi di accesso falliti, violazioni)</li>
                  <li>Indirizzi IP (anonimizzati)</li>
                  <li>User agent</li>
                  <li>Timestamp delle operazioni</li>
                </ul>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  Termini di Cancellazione
                </h3>
                <p className="text-sm text-gray-700">
                  <strong>Log di audit:</strong> conservazione proporzionata, differenziata per finalità e categoria di evento; il GDPR non stabilisce un termine generale di sette anni
                </p>
              </div>
            </div>
          </section>

          {/* Trasferimenti Internazionali */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">7. Trasferimenti Internazionali</h2>
            <p className="text-gray-700 mb-3">
              I dati personali possono essere trasferiti verso i seguenti paesi terzi con le garanzie indicate:
            </p>
            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
              <ul className="text-sm text-gray-700 space-y-2 list-disc pl-6">
                <li>
                  <strong>Stati Uniti d'America:</strong> Render (hosting) e Resend (email) - 
                  Garanzie: Standard Contractual Clauses (SCC) approvate dalla Commissione Europea
                </li>
                <li>
                  <strong>Unione Europea:</strong> Supabase (database PostgreSQL — Francoforte, Germania, `eu-central-1`) - 
                  Conforme GDPR, nessuna garanzia aggiuntiva necessaria
                </li>
              </ul>
            </div>
            <p className="text-gray-700 mt-3">
              Per maggiori dettagli, consulta la sezione <strong>"Trasferimenti Internazionali"</strong> 
              della nostra <Link href="/privacy-policy" className="text-blue-600 hover:text-blue-800 underline">Privacy Policy</Link>.
            </p>
          </section>

          {/* Responsabile del Trattamento */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">8. Responsabile del Trattamento</h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <ul className="text-sm text-gray-700 space-y-2">
                <li><strong>Denominazione:</strong> DemosApp Team</li>
                <li><strong>Email:</strong> privacy@demos.community</li>
                <li><strong>DPO (se designato):</strong> dpo@demos.community</li>
              </ul>
            </div>
          </section>

          {/* Aggiornamenti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">9. Aggiornamenti del Registro</h2>
            <p className="text-gray-700 mb-3">
              Questo registro viene aggiornato regolarmente per riflettere eventuali modifiche nelle 
              attività di trattamento. L'ultimo aggiornamento è stato effettuato il{' '}
              <strong>{new Date().toLocaleDateString('it-IT')}</strong>.
            </p>
            <p className="text-gray-700">
              Il registro è disponibile all'autorità di controllo (Garante per la Protezione dei 
              Dati Personali) su richiesta.
            </p>
          </section>

          {/* Link Utili */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">10. Documenti Correlati</h2>
            <div className="space-y-2">
              <Link 
                href="/privacy-policy" 
                className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
              >
                Privacy Policy
              </Link>
              <Link 
                href="/terms-of-service" 
                className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
              >
                Termini di Servizio
              </Link>
              <Link 
                href="/cookie-policy" 
                className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
              >
                Cookie Policy
              </Link>
            </div>
          </section>

          {/* Footer */}
          <div className="border-t pt-6 mt-8">
            <p className="text-sm text-gray-500 text-center">
              Questo registro è conforme al GDPR Art. 30 e viene mantenuto aggiornato. 
              Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}

