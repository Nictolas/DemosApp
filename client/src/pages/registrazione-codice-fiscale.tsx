import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";


const codiceFiscaleSchema = z.object({
  codice_fiscale: z.string().min(16, "Il codice fiscale deve essere di 16 caratteri").max(16, "Il codice fiscale deve essere di 16 caratteri"),
});

type CodiceFiscaleValues = z.infer<typeof codiceFiscaleSchema>;

export default function RegistrazioneCodiceFiscale() {
  const [, navigate] = useLocation();

  // Stato per il controllo intelligente del codice fiscale
  const [codiceFiscaleStatus, setCodiceFiscaleStatus] = useState<'idle' | 'checking' | 'available' | 'duplicate' | 'error'>('idle');
  const [codiceFiscaleCheckTimeout, setCodiceFiscaleCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  const form = useForm<CodiceFiscaleValues>({
    resolver: zodResolver(codiceFiscaleSchema),
    defaultValues: {
      codice_fiscale: "",
    },
  });

  // Cleanup timeout quando il componente si smonta
  useEffect(() => {
    return () => {
      if (codiceFiscaleCheckTimeout) {
        clearTimeout(codiceFiscaleCheckTimeout);
      }
    };
  }, [codiceFiscaleCheckTimeout]);

  // Controllo intelligente del codice fiscale con debouncing
  const checkCodiceFiscaleIntelligently = async (codiceFiscale: string) => {
    if (!codiceFiscale || codiceFiscale.length < 16) {
      setCodiceFiscaleStatus('idle');
      return;
    }

    try {
      setCodiceFiscaleStatus('checking');
      console.log('🔍 Controllo intelligente codice fiscale:', codiceFiscale);
      
      const apiUrl = `https://demos-c7k0.onrender.com/api/auth/check-codice-fiscale?codice_fiscale=${encodeURIComponent(codiceFiscale.toUpperCase())}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 Risultato controllo intelligente CF:', result);

      if (result.exists) {
        setCodiceFiscaleStatus('duplicate');
      } else {
        setCodiceFiscaleStatus('available');
      }

    } catch (error) {
      console.error('💥 Errore controllo intelligente CF:', error);
      setCodiceFiscaleStatus('error');
    }
  };

  // Gestione cambio codice fiscale con debouncing
  const handleCodiceFiscaleChange = (codiceFiscale: string) => {
    // Cancella timeout precedente
    if (codiceFiscaleCheckTimeout) {
      clearTimeout(codiceFiscaleCheckTimeout);
    }

    // Reset stato se CF vuoto o troppo corto
    if (!codiceFiscale || codiceFiscale.length < 16) {
      setCodiceFiscaleStatus('idle');
      return;
    }

    // Imposta nuovo timeout per controllo dopo 500ms
    const timeout = setTimeout(() => {
      checkCodiceFiscaleIntelligently(codiceFiscale);
    }, 500);

    setCodiceFiscaleCheckTimeout(timeout);
  };

  const onSubmit = (data: CodiceFiscaleValues) => {
    // Verifica che il codice fiscale sia disponibile prima di procedere
    if (codiceFiscaleStatus === 'duplicate') {
      alert('Questo codice fiscale è già registrato nel sistema. Usa un altro codice fiscale.');
      return;
    }

    if (codiceFiscaleStatus === 'checking') {
      alert('Attendi, stiamo ancora verificando il codice fiscale. Riprova tra un momento.');
      return;
    }

    localStorage.setItem("registrazione_codice_fiscale", data.codice_fiscale.toUpperCase());
    navigate("/registrazione-nome");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Qual è il tuo codice fiscale?
          </h2>
          <p className="text-gray-600 text-sm">
            Inserisci il tuo codice fiscale di 16 caratteri
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="codice_fiscale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg font-medium">Codice Fiscale *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Codice Fiscale"
                      className="w-full h-12 text-lg text-center"
                      autoFocus
                      maxLength={16}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(e) => {
                        field.onChange(e);
                        handleCodiceFiscaleChange(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  
                  {/* Feedback visivo per lo stato del codice fiscale */}
                  {codiceFiscaleStatus === 'checking' && (
                    <div className="flex items-center text-sm text-blue-600 mt-1">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando codice fiscale...
                    </div>
                  )}
                  {codiceFiscaleStatus === 'available' && (
                    <div className="flex items-center text-sm text-green-600 mt-1">
                      ✅ Codice fiscale disponibile
                    </div>
                  )}
                  {codiceFiscaleStatus === 'duplicate' && (
                    <div className="flex items-center text-sm text-red-600 mt-1">
                      ❌ Codice fiscale già registrato
                    </div>
                  )}
                  {codiceFiscaleStatus === 'error' && (
                    <div className="flex items-center text-sm text-orange-600 mt-1">
                      ⚠️ Errore verifica codice fiscale
                    </div>
                  )}
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full h-12 text-lg"
              disabled={codiceFiscaleStatus === 'checking' || codiceFiscaleStatus === 'duplicate'}
            >
              {codiceFiscaleStatus === 'checking' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : codiceFiscaleStatus === 'duplicate' ? (
                "Codice Fiscale Già Registrato"
              ) : (
                "Continua"
              )}
            </Button>

            {/* Messaggio informativo per codice fiscale duplicato */}
            {codiceFiscaleStatus === 'duplicate' && (
              <div className="text-center">
                <p className="text-sm text-red-600 mb-2">
                  Questo codice fiscale è già registrato nel sistema.
                </p>
                <p className="text-xs text-gray-500">
                  Usa un altro codice fiscale o accedi se hai già un account.
                </p>
              </div>
            )}
          </form>
        </Form>

                 <div className="text-center mt-6">
           <Button
             variant="ghost"
             onClick={() => navigate("/auth")}
             className="text-gray-500 hover:text-gray-700"
           >
             ← Indietro
           </Button>
         </div>
      </div>
    </div>
  );
}
