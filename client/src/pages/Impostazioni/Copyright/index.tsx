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

        {/* Legal Notice */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Avviso Legale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-orange-800 text-sm leading-relaxed">
                <strong>Disclaimer:</strong> Le informazioni contenute in questa pagina sono fornite 
                a scopo informativo. Per questioni legali specifiche o interpretazioni dei termini, 
                si consiglia di consultare un avvocato specializzato in proprietà intellettuale. 
                I termini qui presentati sono soggetti a modifiche senza preavviso.
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
