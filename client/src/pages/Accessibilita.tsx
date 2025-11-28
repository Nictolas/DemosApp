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
                  Aspetti Conformi
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Struttura semantica HTML corretta</li>
                  <li>Contrasto colori sufficiente per la leggibilità</li>
                  <li>Navigazione da tastiera funzionante</li>
                  <li>Testi alternativi per le immagini</li>
                  <li>Formulari con etichette associate</li>
                  <li>Focus visibile per elementi interattivi</li>
                </ul>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  Aspetti in Miglioramento
                </h3>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
                  <li>Miglioramento della navigazione con screen reader</li>
                  <li>Ottimizzazione dei form per utenti con disabilità motorie</li>
                  <li>Miglioramento dei messaggi di errore e validazione</li>
                  <li>Implementazione di skip links per navigazione rapida</li>
                  <li>Miglioramento della struttura delle pagine complesse</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Contenuti Non Conformi */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Contenuti Non Conformi</h2>
            <p className="text-gray-700 mb-3">
              Alcune parti del sito potrebbero non essere ancora completamente accessibili. Stiamo lavorando 
              attivamente per risolvere questi problemi:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>
                <strong>Alcune pagine complesse:</strong> Potrebbero richiedere miglioramenti nella struttura 
                per una migliore navigazione con screen reader
              </li>
              <li>
                <strong>Alcuni form interattivi:</strong> Potrebbero beneficiare di miglioramenti nella 
                gestione degli errori e nella validazione
              </li>
              <li>
                <strong>Contenuti multimediali:</strong> Alcuni video o contenuti interattivi potrebbero 
                non avere ancora sottotitoli o trascrizioni complete
              </li>
            </ul>
            <p className="text-gray-700">
              <strong>Piano di Miglioramento:</strong> Stiamo implementando miglioramenti incrementali 
              con l'obiettivo di raggiungere la piena conformità WCAG 2.1 Livello AA entro il 2025.
            </p>
          </section>

          {/* Preparazione della Dichiarazione */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Preparazione della Dichiarazione</h2>
            <p className="text-gray-700 mb-3">
              Questa dichiarazione è stata preparata il <strong>{new Date().toLocaleDateString('it-IT')}</strong> 
              e sarà aggiornata regolarmente per riflettere i miglioramenti apportati.
            </p>
            <p className="text-gray-700">
              La valutazione dell'accessibilità è stata effettuata mediante:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Test automatici con strumenti di validazione accessibilità</li>
              <li>Revisione manuale del codice e dell'interfaccia</li>
              <li>Test con screen reader e tecnologie assistive</li>
              <li>Feedback degli utenti</li>
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

