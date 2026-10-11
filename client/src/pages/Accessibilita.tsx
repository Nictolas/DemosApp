import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, CheckCircle, AlertTriangle, Mail, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';

export default function Accessibilita() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pt-20">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center mb-4">
            Dichiarazione di Accessibilità
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
              DemosApp si impegna a garantire l'accessibilità del proprio sito web e delle proprie 
              applicazioni per tutti gli utenti, inclusi quelli con disabilità, conformemente alla 
              <strong> Legge Stanca (L. 4/2004)</strong> e alla <strong>Direttiva UE 2016/2102</strong> 
              sull'accessibilità dei siti web e delle applicazioni mobili degli enti pubblici.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Questa dichiarazione descrive lo stato di accessibilità di DemosApp e le misure adottate 
              per garantire l'accessibilità del servizio.
            </p>
          </section>

          {/* Standard di Riferimento */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Standard di Riferimento</h2>
            <p className="text-gray-700 mb-3">
              DemosApp si impegna a rispettare le seguenti linee guida e standard:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>
                <strong>WCAG 2.1 (Web Content Accessibility Guidelines):</strong> Linee guida internazionali 
                per l'accessibilità dei contenuti web, pubblicate dal W3C (World Wide Web Consortium)
              </li>
              <li>
                <strong>Livello di Conformità Obiettivo:</strong> WCAG 2.1 Livello AA
              </li>
              <li>
                <strong>Legge Stanca (L. 4/2004):</strong> Disposizioni per favorire l'accesso dei soggetti 
                disabili agli strumenti informatici
              </li>
              <li>
                <strong>Direttiva UE 2016/2102:</strong> Direttiva del Parlamento Europeo e del Consiglio 
                sull'accessibilità dei siti web e delle applicazioni mobili degli enti pubblici
              </li>
            </ul>
          </section>

          {/* Stato di Conformità */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Stato di Conformità</h2>
            <Alert className="mb-4 bg-blue-50 border-blue-200">
              <Shield className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Stato Attuale:</strong> DemosApp è in fase di miglioramento continuo dell'accessibilità. 
                Stiamo lavorando per raggiungere la piena conformità con WCAG 2.1 Livello AA.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Supporto gi? verificato nel codice
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Lingua del documento dichiarata e landmark principali presenti nei layout principali</li>
                  <li>Immagini principali con testo alternativo o marcate decorative quando il nome ? fornito dal controllo</li>
                  <li>Componenti UI condivisi con focus visibile e semantica nativa/Radix</li>
                  <li>Regole CSS per ridurre le animazioni con prefers-reduced-motion</li>
                  <li>Zoom del browser consentito e controlli critici corretti per l'uso da tastiera</li>
                </ul>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  Verifiche ancora necessarie
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Test manuali completi con screen reader su web, Android e iOS</li>
                  <li>Verifica sistematica del contrasto colori delle schermate e degli stati interattivi</li>
                  <li>Verifica dei target touch e della navigazione da tastiera nelle superfici legacy residue</li>
                  <li>Verifica di focus trap, focus iniziale e ritorno del focus nei dialoghi personalizzati</li>
                  <li>Verifica dei messaggi dinamici con tecnologie assistive e annunci aria-live</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Contenuti Non Conformi */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Aspetti da completare</h2>
            <p className="text-gray-700 mb-3">
              L'audit tecnico del codice ha individuato aree che richiedono ancora verifica o miglioramento prima di dichiarare la piena conformit? WCAG 2.1 AA:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li><strong>Dialoghi personalizzati:</strong> completare la verifica del comportamento del focus con tastiera e screen reader.</li>
              <li><strong>Controlli legacy:</strong> proseguire la sostituzione dei pattern non semantici e verificare i nomi accessibili dei pulsanti solo-icona.</li>
              <li><strong>Form complessi:</strong> verificare sistematicamente etichette, descrizioni degli errori e ordine del focus.</li>
              <li><strong>Contrasto e zoom testo:</strong> completare i test visuali a 200% e la misurazione del contrasto per tutti gli stati.</li>
              <li><strong>Dispositivi reali:</strong> eseguire prove con VoiceOver e TalkBack prima del go-live.</li>
            </ul>
            <p className="text-gray-700">
              <strong>Piano di miglioramento:</strong> le correzioni vengono applicate per priorit? e la piena conformit? sar? dichiarata soltanto dopo il completamento dei test manuali previsti.
            </p>
          </section>

          {/* Preparazione della Dichiarazione */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Preparazione della Dichiarazione</h2>
            <p className="text-gray-700 mb-3">
              Questa dichiarazione ? aggiornata sulla base dello stato tecnico corrente dell'applicazione.
            </p>
            <p className="text-gray-700">
              La valutazione corrente comprende:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Revisione statica del codice e delle componenti interattive principali</li>
              <li>Controlli anti-regressione automatizzati sulle criticit? gi? individuate</li>
              <li>Build di produzione e verifica di regressioni tecniche</li>
              <li>Test manuali con screen reader e dispositivi reali ancora da completare</li>
            </ul>
          </section>

          {/* Feedback e Contatti */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Feedback e Contatti</h2>
            <p className="text-gray-700 mb-3">
              Se riscontri problemi di accessibilità o hai suggerimenti per migliorare l'accessibilità 
              di DemosApp, ti invitiamo a contattarci:
            </p>
            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <strong className="text-gray-800">Email:</strong>
                  <a 
                    href="mailto:accessibilita@demos.community" 
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    accessibilita@demos.community
                  </a>
                </div>
                <p className="text-sm text-gray-700 mt-2">
                  Ci impegniamo a rispondere alle tue richieste entro <strong>5 giorni lavorativi</strong>.
                </p>
              </div>
            </div>
          </section>

          {/* Procedura di Reclamo */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">7. Procedura di Reclamo</h2>
            <p className="text-gray-700 mb-3">
              Se, dopo averci contattato, non sei soddisfatto della nostra risposta o se ritieni che 
              la piattaforma non rispetti i requisiti di accessibilità, puoi presentare un reclamo:
            </p>
            <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Autorità Competente:</strong>
              </p>
              <p className="text-sm text-gray-700 mb-2">
                Puoi presentare un reclamo all'Agenzia per l'Italia Digitale (AgID) o al Garante per 
                la Protezione dei Dati Personali, secondo le procedure previste dalla normativa vigente.
              </p>
              <div className="mt-3 space-y-1 text-sm">
                <p>
                  <strong>AgID:</strong>{' '}
                  <a 
                    href="https://www.agid.gov.it" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                  >
                    www.agid.gov.it <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
                <p>
                  <strong>Garante Privacy:</strong>{' '}
                  <a 
                    href="https://www.garanteprivacy.it" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                  >
                    www.garanteprivacy.it <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
            </div>
          </section>

          {/* Link Utili */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">8. Link Utili</h2>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>
                <a 
                  href="https://www.w3.org/WAI/WCAG21/quickref/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                >
                  WCAG 2.1 Quick Reference <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a 
                  href="https://www.agid.gov.it/it/design-servizi/accessibilita" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                >
                  AgID - Accessibilità <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a 
                  href="https://www.w3.org/WAI/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                >
                  W3C Web Accessibility Initiative <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </section>

          {/* Documenti Correlati */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">9. Documenti Correlati</h2>
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
              Questa dichiarazione di accessibilità è conforme al modello previsto dalla Direttiva UE 2016/2102 
              e dalla Legge Stanca (L. 4/2004). Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}

