import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, Database, Eye, Key, AlertTriangle } from 'lucide-react';

export default function SecurityMeasures() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center mb-4 flex items-center justify-center gap-3">
            <Shield className="h-8 w-8 text-blue-600" />
            Misure di Sicurezza per la Protezione dei Dati
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
              DemosApp implementa rigorose misure di sicurezza per proteggere i dati personali 
              e politici degli utenti. Questa documentazione descrive le misure tecniche e 
              organizzative adottate per garantire la massima protezione dei dati sensibili.
            </p>
          </section>

          {/* Principi di sicurezza */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Principi di Sicurezza</h2>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Lock className="h-5 w-5 text-blue-600" />
                  Confidenzialità
                </h3>
                <p className="text-gray-700 text-sm">
                  I dati sono accessibili solo a personale autorizzato e per finalità specifiche.
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Database className="h-5 w-5 text-green-600" />
                  Integrità
                </h3>
                <p className="text-gray-700 text-sm">
                  I dati sono protetti da modifiche non autorizzate e corruzioni.
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-purple-600" />
                  Disponibilità
                </h3>
                <p className="text-gray-700 text-sm">
                  I servizi sono disponibili quando necessario con uptime del 99.9%.
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Key className="h-5 w-5 text-orange-600" />
                  Autenticità
                </h3>
                <p className="text-gray-700 text-sm">
                  Verifichiamo l'identità degli utenti e l'origine dei dati.
                </p>
              </div>
            </div>
          </section>

          {/* Misure tecniche */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Misure Tecniche di Sicurezza</h2>
            
            <h3 className="text-xl font-medium mb-2">3.1 Crittografia</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>Trasmissione:</strong> TLS 1.3 per tutte le comunicazioni</li>
                <li><strong>Storage:</strong> Crittografia AES-256 per dati sensibili</li>
                <li><strong>Password:</strong> Hash bcrypt con salt per autenticazione</li>
                <li><strong>Token:</strong> JWT firmati con chiavi RSA-2048</li>
                <li><strong>Database:</strong> Connessioni SSL obbligatorie</li>
              </ul>
            </div>

            <h3 className="text-xl font-medium mb-2">3.2 Autenticazione e Autorizzazione</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>Auth.js:</strong> Framework di autenticazione sicuro</li>
                <li><strong>OAuth 2.0:</strong> Integrazione Google per login sicuro</li>
                <li><strong>JWT:</strong> Token con scadenza e refresh automatico</li>
                <li><strong>2FA:</strong> Autenticazione a due fattori (opzionale)</li>
                <li><strong>Rate Limiting:</strong> Protezione da attacchi brute force</li>
              </ul>
            </div>

            <h3 className="text-xl font-medium mb-2">3.3 Protezione Database</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>Neon PostgreSQL:</strong> Database gestito in UE (Francoforte)</li>
                <li><strong>Backup automatici:</strong> Backup crittografati ogni 6 ore</li>
                <li><strong>Connection Pooling:</strong> Gestione sicura delle connessioni</li>
                <li><strong>Query Sanitization:</strong> Protezione da SQL injection</li>
                <li><strong>Audit Logs:</strong> Registrazione di tutte le operazioni</li>
              </ul>
            </div>

            <h3 className="text-xl font-medium mb-2">3.4 Sicurezza di Rete</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>HTTPS:</strong> Certificati SSL/TLS validi</li>
                <li><strong>HSTS:</strong> HTTP Strict Transport Security</li>
                <li><strong>CSP:</strong> Content Security Policy per XSS</li>
                <li><strong>Firewall:</strong> Protezione perimetrale</li>
                <li><strong>DDoS Protection:</strong> Protezione da attacchi distribuiti</li>
              </ul>
            </div>
          </section>

          {/* Misure organizzative */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Misure Organizzative</h2>
            
            <h3 className="text-xl font-medium mb-2">4.1 Controllo Accessi</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>Principio del minimo privilegio:</strong> Accesso solo ai dati necessari</li>
                <li><strong>Separazione dei ruoli:</strong> Sviluppatori, amministratori, utenti</li>
                <li><strong>Autenticazione forte:</strong> Password complesse obbligatorie</li>
                <li><strong>Log di accesso:</strong> Tracciamento di tutti gli accessi</li>
                <li><strong>Revoca immediata:</strong> Disattivazione account al termine rapporto</li>
              </ul>
            </div>

            <h3 className="text-xl font-medium mb-2">4.2 Formazione del Personale</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>GDPR Training:</strong> Formazione obbligatoria su privacy</li>
                <li><strong>Security Awareness:</strong> Consapevolezza sui rischi informatici</li>
                <li><strong>Best Practices:</strong> Procedure operative sicure</li>
                <li><strong>Incident Response:</strong> Gestione degli incidenti di sicurezza</li>
                <li><strong>Aggiornamenti:</strong> Formazione continua su nuove minacce</li>
              </ul>
            </div>

            <h3 className="text-xl font-medium mb-2">4.3 Gestione dei Fornitori</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>Due Diligence:</strong> Valutazione sicurezza fornitori</li>
                <li><strong>Contratti DPA:</strong> Data Processing Agreements</li>
                <li><strong>Audit periodici:</strong> Verifica conformità fornitori</li>
                <li><strong>Monitoraggio:</strong> Controllo continuo delle prestazioni</li>
                <li><strong>Termine rapporto:</strong> Procedure di disimpegno sicure</li>
              </ul>
            </div>
          </section>

          {/* Protezione dati specifici */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Protezione Dati Specifici</h2>
            
            <h3 className="text-xl font-medium mb-2">5.1 Dati Politici Sensibili</h3>
            <div className="bg-red-50 p-4 rounded-lg mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600 mt-1" />
                <div>
                  <p className="text-gray-700 mb-2">
                    <strong>Protezione Speciale:</strong> I dati politici richiedono misure aggiuntive
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-1">
                    <li>Crittografia end-to-end per opinioni politiche</li>
                    <li>Anonimizzazione dei voti dopo 5 anni</li>
                    <li>Accesso limitato solo a personale autorizzato</li>
                    <li>Audit trail completo per ogni accesso</li>
                    <li>Consenso esplicito per ogni utilizzo</li>
                  </ul>
                </div>
              </div>
            </div>

            <h3 className="text-xl font-medium mb-2">5.2 Dati di Voto</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>Anonimizzazione:</strong> Voti non collegabili all'identità</li>
                <li><strong>Integrità:</strong> Hash crittografici per verificare autenticità</li>
                <li><strong>Immutabilità:</strong> Voti non modificabili dopo l'invio</li>
                <li><strong>Trasparenza:</strong> Algoritmi di voto pubblici e verificabili</li>
                <li><strong>Conservazione:</strong> Dati aggregati anonimi per 5 anni</li>
              </ul>
            </div>

            <h3 className="text-xl font-medium mb-2">5.3 Dati Personali</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>Pseudonimizzazione:</strong> ID univoci invece di dati diretti</li>
                <li><strong>Minimizzazione:</strong> Raccolta solo dati necessari</li>
                <li><strong>Limitazione:</strong> Conservazione per tempo limitato</li>
                <li><strong>Portabilità:</strong> Esportazione dati in formato standard</li>
                <li><strong>Cancellazione:</strong> Rimozione sicura su richiesta</li>
              </ul>
            </div>
          </section>

          {/* Monitoraggio e incidenti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Monitoraggio e Gestione Incidenti</h2>
            
            <h3 className="text-xl font-medium mb-2">6.1 Monitoraggio Continuo</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>SIEM:</strong> Security Information and Event Management</li>
                <li><strong>Log Analysis:</strong> Analisi automatica dei log di sicurezza</li>
                <li><strong>Threat Detection:</strong> Rilevamento anomalie comportamentali</li>
                <li><strong>Performance Monitoring:</strong> Monitoraggio prestazioni sistema</li>
                <li><strong>Alert System:</strong> Notifiche immediate per eventi critici</li>
              </ul>
            </div>

            <h3 className="text-xl font-medium mb-2">6.2 Piano di Risposta agli Incidenti</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>Identificazione:</strong> Rilevamento immediato dell'incidente</li>
                <li><strong>Contenimento:</strong> Isolamento e limitazione danni</li>
                <li><strong>Eradicazione:</strong> Rimozione della causa dell'incidente</li>
                <li><strong>Recupero:</strong> Ripristino servizi e dati</li>
                <li><strong>Lezioni apprese:</strong> Miglioramento misure preventive</li>
              </ul>
            </div>

            <h3 className="text-xl font-medium mb-2">6.3 Notifica alle Autorità</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>Garante Privacy:</strong> Notifica entro 72 ore se necessario</li>
                <li><strong>Utenti interessati:</strong> Comunicazione senza ritardo</li>
                <li><strong>Documentazione:</strong> Registrazione dettagliata dell'incidente</li>
                <li><strong>Misure correttive:</strong> Azioni per prevenire futuri incidenti</li>
              </ul>
            </div>
          </section>

          {/* Conformità e certificazioni */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">7. Conformità e Certificazioni</h2>
            
            <h3 className="text-xl font-medium mb-2">7.1 Standard di Riferimento</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>GDPR:</strong> Regolamento UE 2016/679</li>
                <li><strong>ISO 27001:</strong> Sistema di gestione sicurezza informatica</li>
                <li><strong>NIST Framework:</strong> Cybersecurity Framework</li>
                <li><strong>OWASP Top 10:</strong> Protezione applicazioni web</li>
                <li><strong>PCI DSS:</strong> Sicurezza dati pagamenti (se applicabile)</li>
              </ul>
            </div>

            <h3 className="text-xl font-medium mb-2">7.2 Audit e Verifiche</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li><strong>Penetration Testing:</strong> Test di sicurezza annuali</li>
                <li><strong>Vulnerability Assessment:</strong> Scansioni regolari</li>
                <li><strong>Code Review:</strong> Revisione codice per sicurezza</li>
                <li><strong>Third-party Audit:</strong> Verifiche esterne indipendenti</li>
                <li><strong>Compliance Check:</strong> Verifica conformità normative</li>
              </ul>
            </div>
          </section>

          {/* Contatti sicurezza */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">8. Contatti per la Sicurezza</h2>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-gray-700 mb-3">
                Per segnalare vulnerabilità di sicurezza o incidenti:
              </p>
              <ul className="list-none text-gray-700 space-y-2">
                <li><strong>Email Sicurezza:</strong> security@demos.community</li>
                <li><strong>DPO (Data Protection Officer):</strong> dpo@demos.community</li>
                <li><strong>Incident Response:</strong> incident@demos.community</li>
                <li><strong>Responsabile Sicurezza:</strong> ciso@demos.community</li>
              </ul>
            </div>
          </section>

          {/* Footer */}
          <div className="border-t pt-6 mt-8">
            <p className="text-sm text-gray-500 text-center">
              Queste misure di sicurezza sono implementate e monitorate continuamente. 
              Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
