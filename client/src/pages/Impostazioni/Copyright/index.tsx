import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Copyright, Shield, FileText, Scale, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

export default function CopyrightPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Accesso Richiesto</CardTitle>
            <CardDescription>Devi effettuare il login per accedere alle informazioni di copyright.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation('/auth')}>
              Vai al Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white page-with-navbar">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/impostazioni')}
            className="mb-4"
          >
            ← Torna alle Impostazioni
          </Button>
          
          <Card className="border-0 shadow-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
            <CardHeader className="text-center py-6">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Copyright className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold mb-2">
                Copyright e Proprietà Intellettuale
              </CardTitle>
              <CardDescription className="text-indigo-100 text-lg">
                Informazioni sui diritti di proprietà e termini d'uso
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Copyright Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Copyright className="h-6 w-6 text-indigo-600" />
              Informazioni Copyright
            </CardTitle>
            <CardDescription>
              Tutte le informazioni relative ai diritti di proprietà del software Demos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Demos versione 1.0</h3>
              <p className="text-lg text-gray-700 mb-4">
                <strong>Copyright © 2025 Nicolas Micheletti. Tutti i diritti riservati.</strong>
              </p>
              <p className="text-gray-600">
                Questo software e tutti i suoi contenuti sono protetti dalle leggi sul copyright 
                e dalla legislazione internazionale sulla proprietà intellettuale.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  Proprietà del Software
                </h4>
                <ul className="space-y-2 text-gray-600">
                  <li>• Codice sorgente e algoritmi</li>
                  <li>• Interfaccia utente e design</li>
                  <li>• Database e strutture dati</li>
                  <li>• Documentazione tecnica</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Contenuti Protetti
                </h4>
                <ul className="space-y-2 text-gray-600">
                  <li>• Testi e contenuti editoriali</li>
                  <li>• Grafica e immagini</li>
                  <li>• Loghi e marchi</li>
                  <li>• Configurazioni e impostazioni</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms and Conditions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Scale className="h-6 w-6 text-purple-600" />
              Termini e Condizioni d'Uso
            </CardTitle>
            <CardDescription>
              Condizioni per l'utilizzo del software Demos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> L'utilizzo di questo software implica l'accettazione 
                dei seguenti termini e condizioni.
              </AlertDescription>
            </Alert>

            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">1. Proprietà Intellettuale</h4>
                <p className="text-gray-600 leading-relaxed">
                  Tutti i diritti sul software Demos e sui suoi contenuti sono riservati e protetti dalla legge. 
                  Il software, inclusi ma non limitati a codice sorgente, interfacce utente, algoritmi, 
                  database, documentazione e tutti i materiali correlati, sono di esclusiva proprietà di 
                  Nicolas Micheletti.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">2. Utilizzo Consentito</h4>
                <p className="text-gray-600 leading-relaxed mb-3">
                  È consentito l'utilizzo del software esclusivamente per:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-600 ml-4">
                  <li>Scopi personali e non commerciali</li>
                  <li>Test e valutazione del software</li>
                  <li>Utilizzo in conformità con la licenza d'uso</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">3. Divieti</h4>
                <p className="text-gray-600 leading-relaxed mb-3">
                  È espressamente vietato:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-600 ml-4">
                  <li>Riprodurre, distribuire o modificare il software senza autorizzazione</li>
                  <li>Eseguire reverse engineering o decompilazione</li>
                  <li>Utilizzare il software per scopi commerciali non autorizzati</li>
                  <li>Rimuovere o modificare avvisi di copyright</li>
                  <li>Creare opere derivate senza consenso scritto</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">4. Violazioni</h4>
                <p className="text-gray-600 leading-relaxed">
                  Qualsiasi violazione di questi termini costituisce una violazione del copyright e 
                  delle leggi sulla proprietà intellettuale, soggetta a tutte le sanzioni previste 
                  dalla legge, inclusi danni monetari e inibitorie.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">5. Contatto</h4>
                <p className="text-gray-600 leading-relaxed">
                  Per richieste di autorizzazione, licenze o informazioni sui diritti di proprietà, 
                  contattare: Nicolas Micheletti tramite i canali ufficiali della piattaforma Demos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Severe Legal Warning */}
        <Card className="mb-6 border-red-500 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl text-red-800">
              <AlertCircle className="h-6 w-6 text-red-600" />
              ⚠️ AVVISO LEGALE SEVERO - VIOLAZIONE COPYRIGHT ⚠️
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-red-100 border-2 border-red-300 rounded-lg p-6">
              <h3 className="text-xl font-bold text-red-900 mb-4">🚨 PROTEZIONE LEGALE ASSOLUTA 🚨</h3>
              <p className="text-red-800 text-lg leading-relaxed mb-4">
                <strong>ATTENZIONE CRITICA:</strong> Il software Demos e tutte le sue funzionalità, 
                algoritmi, interfacce utente, database, architettura, logica di business, 
                processi di autenticazione, sistemi di voto, meccanismi di compatibilità, 
                strutture dati, API, endpoint, middleware, componenti React, stili CSS, 
                configurazioni, documentazione tecnica, e qualsiasi altro elemento costituente 
                la piattaforma sono PROTETTI DA COPYRIGHT e PROPRIETÀ INTELLETTUALE ESCLUSIVA.
              </p>
              
              <div className="bg-red-200 border border-red-400 rounded-lg p-4 mb-4">
                <h4 className="text-lg font-bold text-red-900 mb-3">⚖️ VIOLAZIONI PENALI E CIVILI ⚖️</h4>
                <p className="text-red-800 font-semibold mb-3">
                  QUALSIASI TENTATIVO DI REPLICA, COPIA, CLONAZIONE, IMITAZIONE, 
                  REVERSE ENGINEERING, O CREAZIONE DI APPLICAZIONI SIMILI SARÀ 
                  IMMEDIATAMENTE DENUNCIATO E PERSEGUITO PENALMENTE E CIVILMENTE.
                </p>
                <ul className="list-disc list-inside space-y-2 text-red-800 font-medium">
                  <li><strong>Violazione Copyright:</strong> Sanzioni fino a €150.000 + risarcimento danni</li>
                  <li><strong>Concorrenza Sleale:</strong> Inibitoria immediata + danni patrimoniali</li>
                  <li><strong>Furto di Proprietà Intellettuale:</strong> Procedimento penale + carcere</li>
                  <li><strong>Violazione Segreti Commerciali:</strong> Danni punitivi + risarcimento integrale</li>
                  <li><strong>Uso Non Autorizzato:</strong> €50.000 per ogni giorno di violazione</li>
                </ul>
              </div>

              <div className="bg-red-300 border border-red-500 rounded-lg p-4 mb-4">
                <h4 className="text-lg font-bold text-red-900 mb-3">🔍 MONITORAGGIO CONTINUO 🔍</h4>
                <p className="text-red-800 font-semibold mb-3">
                  IL SISTEMA È SOTTO MONITORAGGIO 24/7 CON SISTEMI DI RILEVAMENTO AUTOMATICO 
                  DI VIOLAZIONI. OGNI TENTATIVO DI ACCESSO NON AUTORIZZATO, COPIA, O REPLICA 
                  VERRÀ IMMEDIATAMENTE TRACCIATO E DENUNCIATO.
                </p>
                <ul className="list-disc list-inside space-y-1 text-red-800">
                  <li>Logging completo di tutti gli accessi e tentativi di reverse engineering</li>
                  <li>Analisi automatica del codice sorgente per rilevare somiglianze</li>
                  <li>Monitoraggio delle applicazioni web per identificare cloni</li>
                  <li>Tracciamento IP e geolocalizzazione di violatori</li>
                  <li>Collaborazione con autorità competenti per azioni legali immediate</li>
                </ul>
              </div>

              <div className="bg-red-400 border border-red-600 rounded-lg p-4">
                <h4 className="text-lg font-bold text-red-900 mb-3">⚡ AZIONI LEGALI IMMEDIATE ⚡</h4>
                <p className="text-red-800 font-bold text-lg mb-3">
                  IN CASO DI VIOLAZIONE, SARANNO IMMEDIATAMENTE INTRODOTTE:
                </p>
                <ul className="list-disc list-inside space-y-2 text-red-900 font-semibold">
                  <li><strong>Denuncia Penale:</strong> Presso Procura della Repubblica competente</li>
                  <li><strong>Procedimento Civile:</strong> Richiesta di inibitoria urgente + danni</li>
                  <li><strong>Sequestro Preventivo:</strong> Di tutti i beni e strumenti utilizzati</li>
                  <li><strong>Blocco Domini:</strong> Richiesta immediata di oscuramento</li>
                  <li><strong>Risarcimento Danni:</strong> Calcolato su base giornaliera + interessi</li>
                  <li><strong>Pubblicazione Sentenza:</strong> Su tutti i media per diffamazione</li>
                </ul>
              </div>
            </div>

            <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-6">
              <h4 className="text-xl font-bold text-yellow-900 mb-4">📋 ELEMENTI SPECIFICAMENTE PROTETTI</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="font-bold text-yellow-900 mb-2">Sistema di Autenticazione:</h5>
                  <ul className="text-yellow-800 text-sm space-y-1">
                    <li>• Meccanismi di login e registrazione</li>
                    <li>• Gestione sessioni e token JWT</li>
                    <li>• Sistemi di verifica email</li>
                    <li>• Reset password e sicurezza</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-bold text-yellow-900 mb-2">Sistema di Voto:</h5>
                  <ul className="text-yellow-800 text-sm space-y-1">
                    <li>• Algoritmi di calcolo compatibilità</li>
                    <li>• Meccanismi di selezione candidati</li>
                    <li>• Sistemi di conteggio e ranking</li>
                    <li>• Logica di filtraggio risultati</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-bold text-yellow-900 mb-2">Interfaccia Utente:</h5>
                  <ul className="text-yellow-800 text-sm space-y-1">
                    <li>• Design e layout delle pagine</li>
                    <li>• Componenti React personalizzati</li>
                    <li>• Stili CSS e animazioni</li>
                    <li>• Esperienza utente e navigazione</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-bold text-yellow-900 mb-2">Database e API:</h5>
                  <ul className="text-yellow-800 text-sm space-y-1">
                    <li>• Struttura tabelle e relazioni</li>
                    <li>• Endpoint API e middleware</li>
                    <li>• Sistemi di rate limiting</li>
                    <li>• Logiche di business e validazione</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gray-100 border border-gray-400 rounded-lg p-6">
              <h4 className="text-xl font-bold text-gray-900 mb-4">📞 CONTATTI PER DENUNCE</h4>
              <p className="text-gray-800 font-semibold mb-3">
                Per segnalare violazioni o richiedere autorizzazioni:
              </p>
              <ul className="text-gray-700 space-y-1">
                <li><strong>Email Legale:</strong> legal@demos.community</li>
                <li><strong>Avvocato:</strong> Studio Legale specializzato in proprietà intellettuale</li>
                <li><strong>Denunce Anonime:</strong> Tramite sistema di segnalazione interno</li>
                <li><strong>Emergenze:</strong> +39 [NUMERO] per violazioni in corso</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Final Legal Threat */}
        <Card className="mb-6 border-black bg-black text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-3xl text-red-400">
              ⚠️ ULTIMO AVVISO LEGALE ⚠️
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-red-900 border-4 border-red-600 rounded-lg p-8">
              <h3 className="text-3xl font-bold text-red-200 mb-6 text-center">
                🚨 ZERO TOLERANZA PER VIOLAZIONI 🚨
              </h3>
              
              <div className="bg-black border border-red-500 rounded-lg p-6 mb-6">
                <h4 className="text-2xl font-bold text-red-300 mb-4 text-center">
                  ⚖️ DICHIARAZIONE LEGALE UFFICIALE ⚖️
                </h4>
                <p className="text-red-100 text-xl leading-relaxed mb-6 text-center font-semibold">
                  NICHOLAS MICHELETTI, TITOLARE ESCLUSIVO DEI DIRITTI DI PROPRIETÀ INTELLETTUALE 
                  SUL SOFTWARE DEMOS, DICHIARA UFFICIALMENTE CHE:
                </p>
                
                <div className="space-y-4">
                  <div className="bg-red-800 border border-red-400 rounded-lg p-4">
                    <p className="text-red-100 text-lg font-bold mb-2">
                      1. OGNI TENTATIVO DI REPLICA, CLONAZIONE, O IMITAZIONE DELLA PIATTAFORMA DEMOS 
                      COSTITUISCE VIOLAZIONE GRAVE DEL COPYRIGHT E SARÀ PERSEGUITA CON LA MASSIMA 
                      SEVERITÀ DELLA LEGGE.
                    </p>
                  </div>
                  
                  <div className="bg-red-800 border border-red-400 rounded-lg p-4">
                    <p className="text-red-100 text-lg font-bold mb-2">
                      2. I SISTEMI DI MONITORAGGIO AUTOMATICO SONO ATTIVI 24/7 E TRACCIANO OGNI 
                      TENTATIVO DI ACCESSO NON AUTORIZZATO, REVERSE ENGINEERING, O COPIA DEL CODICE.
                    </p>
                  </div>
                  
                  <div className="bg-red-800 border border-red-400 rounded-lg p-4">
                    <p className="text-red-100 text-lg font-bold mb-2">
                      3. IN CASO DI VIOLAZIONE, SARANNO IMMEDIATAMENTE ATTIVATE TUTTE LE PROCEDURE 
                      LEGALI DISPONIBILI, INCLUSI SEQUESTRI, INIBITORIE, E RICHIESTE DI RISARCIMENTO 
                      DANNI PER MILIONI DI EURO.
                    </p>
                  </div>
                  
                  <div className="bg-red-800 border border-red-400 rounded-lg p-4">
                    <p className="text-red-100 text-lg font-bold mb-2">
                      4. I VIOLATORI SARANNO DENUNCIATI PENALMENTE E CIVILMENTE, CON PUBBLICAZIONE 
                      DELLE SENTENZE SU TUTTI I MEDIA PER GARANTIRE MASSIMA DIFFUSIONE DELLA 
                      CONDANNA.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-900 border-2 border-yellow-500 rounded-lg p-6">
                <h4 className="text-2xl font-bold text-yellow-200 mb-4 text-center">
                  💰 CALCOLO DANNI ECONOMICI 💰
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-black border border-yellow-400 rounded-lg p-4">
                    <h5 className="text-lg font-bold text-yellow-300 mb-2">Danni Diretti:</h5>
                    <ul className="text-yellow-200 space-y-1">
                      <li>• €500.000 per ogni giorno di violazione</li>
                      <li>• €1.000.000 per perdita di profitti</li>
                      <li>• €2.000.000 per danni reputazionali</li>
                      <li>• €5.000.000 per violazione segreti commerciali</li>
                    </ul>
                  </div>
                  <div className="bg-black border border-yellow-400 rounded-lg p-4">
                    <h5 className="text-lg font-bold text-yellow-300 mb-2">Danni Punitivi:</h5>
                    <ul className="text-yellow-200 space-y-1">
                      <li>• €10.000.000 per concorrenza sleale</li>
                      <li>• €15.000.000 per furto proprietà intellettuale</li>
                      <li>• €25.000.000 per danni morali</li>
                      <li>• €50.000.000 per danni punitivi</li>
                    </ul>
                  </div>
                </div>
                <p className="text-yellow-200 text-xl font-bold text-center mt-4">
                  TOTALE MINIMO: €100.000.000 + INTERESSI + SPESE LEGALI
                </p>
              </div>

              <div className="bg-green-900 border-2 border-green-500 rounded-lg p-6">
                <h4 className="text-2xl font-bold text-green-200 mb-4 text-center">
                  ✅ AUTORIZZAZIONI E LICENZE ✅
                </h4>
                <p className="text-green-100 text-lg text-center mb-4">
                  L'UNICO MODO PER UTILIZZARE ELEMENTI DEL SOFTWARE DEMOS È OTTENERE 
                  UNA LICENZA UFFICIALE SCRITTA E FIRMATA DA NICHOLAS MICHELETTI.
                </p>
                <div className="bg-black border border-green-400 rounded-lg p-4">
                  <h5 className="text-lg font-bold text-green-300 mb-2">Processo di Licenza:</h5>
                  <ol className="text-green-200 space-y-1 list-decimal list-inside">
                    <li>Richiesta formale via email legale</li>
                    <li>Valutazione tecnica e commerciale</li>
                    <li>Negoziazione termini e condizioni</li>
                    <li>Firma contratto di licenza ufficiale</li>
                    <li>Pagamento royalty e commissioni</li>
                    <li>Monitoraggio conformità continua</li>
                  </ol>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => setLocation('/impostazioni')}
            className="px-8"
          >
            Torna alle Impostazioni
          </Button>
          <Button
            onClick={() => window.print()}
            className="px-8"
          >
            Stampa Pagina
          </Button>
        </div>
      </div>
    </div>
  );
}
