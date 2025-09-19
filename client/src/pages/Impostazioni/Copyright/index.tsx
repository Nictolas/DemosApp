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

        {/* Severe Legal Warning - Replaces Terms and Conditions */}
        <Card className="mb-6 border-red-500 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-3xl text-red-800">
              <AlertCircle className="h-8 w-8 text-red-600" />
              🚨 VIOLAZIONE COPYRIGHT - ZERO TOLERANZA 🚨
            </CardTitle>
            <CardDescription className="text-red-700 text-lg">
              Ogni tentativo di replica, copia o clonazione sarà perseguito legalmente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="bg-red-100 border-4 border-red-400 rounded-xl p-8">
              <h3 className="text-2xl font-bold text-red-900 mb-6 text-center">
                ⚠️ AVVISO LEGALE UFFICIALE ⚠️
              </h3>
              <p className="text-red-800 text-xl leading-relaxed mb-6 text-center font-bold">
                NICHOLAS MICHELETTI, TITOLARE ESCLUSIVO DEI DIRITTI DI PROPRIETÀ INTELLETTUALE 
                SUL SOFTWARE DEMOS, DICHIARA UFFICIALMENTE:
              </p>
              
              <div className="space-y-6">
                <div className="bg-red-200 border-2 border-red-500 rounded-lg p-6">
                  <h4 className="text-xl font-bold text-red-900 mb-4">1. PROTEZIONE ASSOLUTA</h4>
                  <p className="text-red-800 text-lg font-semibold">
                    OGNI ELEMENTO DEL SOFTWARE DEMOS È PROTETTO DA COPYRIGHT E PROPRIETÀ INTELLETTUALE ESCLUSIVA. 
                    QUESTO INCLUDE MA NON È LIMITATO A: CODICE SORGENTE, ALGORITMI, INTERFACCE UTENTE, 
                    DATABASE, API, MIDDLEWARE, COMPONENTI REACT, STILI CSS, CONFIGURAZIONI, DOCUMENTAZIONE, 
                    E OGNI ALTRO ELEMENTO COSTITUENTE LA PIATTAFORMA.
                  </p>
                </div>
                
                <div className="bg-red-300 border-2 border-red-600 rounded-lg p-6">
                  <h4 className="text-xl font-bold text-red-900 mb-4">2. VIOLAZIONI PENALI E CIVILI</h4>
                  <p className="text-red-800 text-lg font-bold mb-4">
                    QUALSIASI TENTATIVO DI REPLICA, CLONAZIONE, IMITAZIONE, REVERSE ENGINEERING, 
                    O CREAZIONE DI APPLICAZIONI SIMILI SARÀ IMMEDIATAMENTE DENUNCIATO E PERSEGUITO 
                    CON LA MASSIMA SEVERITÀ DELLA LEGGE.
                  </p>
                  <ul className="text-red-900 font-bold space-y-2">
                    <li>• <strong>Violazione Copyright:</strong> €150.000 + risarcimento danni</li>
                    <li>• <strong>Concorrenza Sleale:</strong> Inibitoria immediata + danni patrimoniali</li>
                    <li>• <strong>Furto Proprietà Intellettuale:</strong> Procedimento penale + carcere</li>
                    <li>• <strong>Uso Non Autorizzato:</strong> €50.000 per ogni giorno di violazione</li>
                  </ul>
                </div>
                
                <div className="bg-red-400 border-2 border-red-700 rounded-lg p-6">
                  <h4 className="text-xl font-bold text-red-900 mb-4">3. MONITORAGGIO 24/7</h4>
                  <p className="text-red-800 text-lg font-bold mb-4">
                    IL SISTEMA È SOTTO MONITORAGGIO CONTINUO CON SISTEMI DI RILEVAMENTO AUTOMATICO. 
                    OGNI TENTATIVO DI ACCESSO NON AUTORIZZATO, COPIA, O REPLICA VERRÀ IMMEDIATAMENTE 
                    TRACCIATO E DENUNCIATO.
                  </p>
                  <ul className="text-red-900 font-semibold space-y-1">
                    <li>• Logging completo di tutti gli accessi e tentativi di reverse engineering</li>
                    <li>• Analisi automatica del codice sorgente per rilevare somiglianze</li>
                    <li>• Monitoraggio delle applicazioni web per identificare cloni</li>
                    <li>• Tracciamento IP e geolocalizzazione di violatori</li>
                    <li>• Collaborazione con autorità competenti per azioni legali immediate</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-yellow-100 border-4 border-yellow-500 rounded-xl p-8">
              <h4 className="text-2xl font-bold text-yellow-900 mb-6 text-center">
                💰 CALCOLO DANNI ECONOMICI 💰
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-yellow-200 border-2 border-yellow-600 rounded-lg p-6">
                  <h5 className="text-xl font-bold text-yellow-900 mb-4">Danni Diretti:</h5>
                  <ul className="text-yellow-800 font-bold space-y-2">
                    <li>• €500.000 per ogni giorno di violazione</li>
                    <li>• €1.000.000 per perdita di profitti</li>
                    <li>• €2.000.000 per danni reputazionali</li>
                    <li>• €5.000.000 per violazione segreti commerciali</li>
                  </ul>
                </div>
                <div className="bg-yellow-200 border-2 border-yellow-600 rounded-lg p-6">
                  <h5 className="text-xl font-bold text-yellow-900 mb-4">Danni Punitivi:</h5>
                  <ul className="text-yellow-800 font-bold space-y-2">
                    <li>• €10.000.000 per concorrenza sleale</li>
                    <li>• €15.000.000 per furto proprietà intellettuale</li>
                    <li>• €25.000.000 per danni morali</li>
                    <li>• €50.000.000 per danni punitivi</li>
                  </ul>
                </div>
              </div>
              <div className="bg-yellow-300 border-2 border-yellow-700 rounded-lg p-6 mt-6">
                <p className="text-yellow-900 text-2xl font-bold text-center">
                  TOTALE MINIMO: €100.000.000 + INTERESSI + SPESE LEGALI
                </p>
              </div>
            </div>

            <div className="bg-gray-100 border-4 border-gray-500 rounded-xl p-8">
              <h4 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                📞 CONTATTI PER DENUNCE E LICENZE
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-200 border-2 border-gray-600 rounded-lg p-6">
                  <h5 className="text-xl font-bold text-gray-900 mb-4">Per Denunce:</h5>
                  <ul className="text-gray-800 font-semibold space-y-2">
                    <li>• <strong>Email Legale:</strong> legal@demos.community</li>
                    <li>• <strong>Avvocato:</strong> Studio Legale specializzato</li>
                    <li>• <strong>Denunce Anonime:</strong> Sistema interno</li>
                    <li>• <strong>Emergenze:</strong> +39 [NUMERO]</li>
                  </ul>
                </div>
                <div className="bg-gray-200 border-2 border-gray-600 rounded-lg p-6">
                  <h5 className="text-xl font-bold text-gray-900 mb-4">Per Licenze:</h5>
                  <p className="text-gray-800 font-semibold mb-4">
                    L'UNICO MODO PER UTILIZZARE ELEMENTI DEL SOFTWARE È OTTENERE 
                    UNA LICENZA UFFICIALE SCRITTA E FIRMATA DA NICHOLAS MICHELETTI.
                  </p>
                  <ol className="text-gray-800 font-semibold space-y-1 list-decimal list-inside">
                    <li>Richiesta formale via email legale</li>
                    <li>Valutazione tecnica e commerciale</li>
                    <li>Negoziazione termini e condizioni</li>
                    <li>Firma contratto di licenza ufficiale</li>
                    <li>Pagamento royalty e commissioni</li>
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
