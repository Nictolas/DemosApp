import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Scale, Shield, FileText, Copyright } from "lucide-react";
import { useLocation } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { Link } from "wouter";

export default function InformazioniLegali() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <PageContainer className="bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer className="bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Accesso Richiesto</CardTitle>
            <CardDescription>Devi effettuare il login per accedere alle informazioni legali.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation('/auth')}>
              Vai al Login
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-gradient-to-b from-blue-50 to-white">
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
          
          <Card className="border-0 shadow-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
            <CardHeader className="text-center py-6">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Scale className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold mb-2">
                Informazioni Legali
              </CardTitle>
              <CardDescription className="text-indigo-100 text-lg">
                Consulta i documenti legali e le informazioni sulla piattaforma
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Pulsanti Informazioni Legali */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* GDPR */}
          <Link href="/gdpr">
            <Button 
              variant="outline" 
              className="w-full justify-start h-20 rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">GDPR</div>
                <div className="text-xs text-gray-600">Diritti e gestione dati</div>
              </div>
            </Button>
          </Link>

          {/* Privacy Policy */}
          <Link href="/privacy-policy">
            <Button
              variant="outline"
              className="w-full justify-start h-20 rounded-xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 hover:border-emerald-300 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Privacy Policy</div>
                <div className="text-xs text-gray-600">Informativa sul trattamento dei dati</div>
              </div>
            </Button>
          </Link>

          {/* Termini di servizio */}
          <Link href="/terms-of-service">
            <Button 
              variant="outline" 
              className="w-full justify-start h-20 rounded-xl border-2 border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100 hover:border-teal-300 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Termini di servizio</div>
                <div className="text-xs text-gray-600">Condizioni di utilizzo della piattaforma</div>
              </div>
            </Button>
          </Link>

          {/* Copyright */}
          <Link href="/impostazioni/copyright">
            <Button 
              variant="outline" 
              className="w-full justify-start h-20 rounded-xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 hover:border-indigo-300 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                <Copyright className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Copyright</div>
                <div className="text-xs text-gray-600">Diritti e proprietà</div>
              </div>
            </Button>
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}

