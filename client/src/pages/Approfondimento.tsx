import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { addCountryFlagsToMarkdown } from "@/lib/countryFlagsMarkdown";

interface ApprofondimentoData {
  id: string;
  text: string;
  approfondimento: string;
  gradi_opinione: string[];
}

export default function Approfondimento() {
  const [, setLocation] = useLocation();
  const [approfondimento, setApprofondimento] = useState<ApprofondimentoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ottieni l'ID dell'opinione dall'URL
  const urlParams = new URLSearchParams(window.location.search);
  const opinioneId = urlParams.get('id');

  useEffect(() => {
    if (opinioneId) {
      loadApprofondimento(opinioneId);
    } else {
      setError("ID opinione non specificato");
      setIsLoading(false);
    }
  }, [opinioneId]);

  const loadApprofondimento = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await apiRequest("GET", `/api/opinioni/${id}/approfondimento`);
      
      if (response.ok) {
        const data = await response.json();
        setApprofondimento(data.data);
      } else {
        setError("Approfondimento non trovato");
      }
    } catch (error) {
      console.error('Errore nel caricamento dell\'approfondimento:', error);
      setError("Errore nel caricamento dell'approfondimento");
    } finally {
      setIsLoading(false);
    }
  };

  const renderMarkdown = (text: string) => {
    return text
      // Link stile pulsante
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 no-underline">$1</a>'
      )
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2 text-gray-800">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2 text-gray-800">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2 text-gray-900">$1</h1>')
      .replace(/^\* (.*$)/gim, '<li class="ml-4 mb-1">$1</li>')
      .replace(/^- (.*$)/gim, '<li class="ml-4 mb-1">$1</li>')
      .replace(/^(\d+\.) (.*$)/gim, '<li class="ml-4 mb-1"><strong>$1</strong> $2</li>');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-lg text-gray-600">Caricamento approfondimento...</p>
        </div>
      </div>
    );
  }

  if (error || !approfondimento) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-red-100 to-red-200 page-with-navbar flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-xl">
          <FileText className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-red-700 mb-4">Errore</h2>
          <p className="text-lg text-gray-700 mb-4">{error}</p>
          <Button onClick={() => setLocation("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna alla Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar">
      <div className="container mx-auto max-w-4xl p-6">
        <Button 
          variant="ghost" 
          className="mb-6 flex items-center" 
          onClick={() => setLocation("/")}
        > 
          <ArrowLeft className="mr-2 h-4 w-4" /> 
          Torna alla Home 
        </Button>
        
        <Card className="shadow-lg">
          <CardHeader className="text-center bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl font-bold">
              Approfondimento
            </CardTitle>
            <CardDescription className="text-blue-100">
              {approfondimento.text}
            </CardDescription>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {approfondimento.gradi_opinione?.map((grado) => (
                <span 
                  key={grado}
                  className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium"
                >
                  {grado}
                </span>
              ))}
            </div>
          </CardHeader>
          
          <CardContent className="p-8">
            {approfondimento.approfondimento ? (
              <div 
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: sanitizeRichHtml(renderMarkdown(addCountryFlagsToMarkdown(approfondimento.approfondimento)))
                }}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Nessun approfondimento disponibile per questa opinione.</p>
                <p className="text-sm mt-2">Torna più tardi per vedere se sono stati aggiunti contenuti.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
