import React from "react";
import { useAuth } from "@/hooks/use-auth";
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
      <div className="min-h-screen bg-linear-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-b from-blue-50 to-white flex items-center justify-center">
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
    <div className="min-h-screen bg-linear-to-b from-blue-50 to-white page-with-navbar">
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
          
          <Card className="border-0 shadow-lg bg-linear-to-r from-indigo-600 to-blue-600 text-white">
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
            <div className="bg-linear-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-200">
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

        {/* Legal Notice - Professional Version */}
        <Card className="mb-6 border-gray-300 bg-gray-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl text-gray-800">
              <AlertCircle className="h-6 w-6 text-gray-600" />
              Avviso Legale - Proprietà Intellettuale
            </CardTitle>
            <CardDescription className="text-gray-700">
              Tutti i diritti riservati - Violazioni perseguite per legge
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-white border border-gray-300 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Dichiarazione di Proprietà Intellettuale
              </h3>
              <p className="text-gray-800 text-lg leading-relaxed mb-4">
                <strong>Nicolas Micheletti</strong>, titolare esclusivo dei diritti di proprietà intellettuale 
                sul software Demos, dichiara ufficialmente che:
              </p>
              
              <div className="space-y-4">
                <div className="border-l-4 border-gray-400 pl-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">1. Protezione del Software</h4>
                  <p className="text-gray-700 leading-relaxed">
                    Ogni elemento del software Demos è protetto da copyright e proprietà intellettuale esclusiva. 
                    Questo include, ma non è limitato a: codice sorgente, algoritmi, interfacce utente, 
                    database, API, middleware, componenti React, stili CSS, configurazioni, documentazione 
                    e ogni altro elemento costituente la piattaforma.
                  </p>
                </div>
                
                <div className="border-l-4 border-gray-400 pl-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">2. Divieti e Violazioni</h4>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    È espressamente vietato qualsiasi tentativo di replica, clonazione, imitazione, 
                    reverse engineering o creazione di applicazioni simili. Tali violazioni saranno 
                    immediatamente denunciate e perseguite con la massima severità della legge.
                  </p>
                  <ul className="text-gray-700 space-y-1 list-disc list-inside">
                    <li>Violazione del copyright e delle leggi sulla proprietà intellettuale</li>
                    <li>Concorrenza sleale e appropriazione indebita di segreti commerciali</li>
                    <li>Uso non autorizzato di marchi, loghi e elementi distintivi</li>
                    <li>Creazione di opere derivate senza consenso scritto</li>
                  </ul>
                </div>
                
                <div className="border-l-4 border-gray-400 pl-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">3. Monitoraggio e Controlli</h4>
                  <p className="text-gray-700 leading-relaxed">
                    Il sistema è sottoposto a monitoraggio continuo con sistemi di rilevamento automatico. 
                    Ogni tentativo di accesso non autorizzato, copia o replica verrà immediatamente 
                    tracciato e denunciato alle autorità competenti.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-300 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Data di Pubblicazione</h4>
              <p className="text-gray-700 leading-relaxed">
                <strong>Data di aggiornamento:</strong> 20 settembre 2025
              </p>
              <p className="text-gray-600 text-sm mt-2">
                Questo documento è stato aggiornato per riflettere le modifiche più recenti 
                alla piattaforma Demos e alle relative politiche di proprietà intellettuale.
              </p>
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
