import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function RegistrazioneRuolo() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  // Ruolo automaticamente impostato a "Elettore" per tutti i nuovi utenti

  const handleComplete = async () => {
    try {
      // Raccoglie tutti i dati dal localStorage
      const email = localStorage.getItem("registrazione_email");
      const password = localStorage.getItem("registrazione_password");
      const nome = localStorage.getItem("registrazione_nome");
      const cognome = localStorage.getItem("registrazione_cognome");
      const genere = localStorage.getItem("registrazione_genere");
      const cittadinanza = localStorage.getItem("registrazione_cittadinanza");
      const dataNascita = localStorage.getItem("registrazione_data_nascita");
      const paeseResidenza = localStorage.getItem("registrazione_paese_residenza");
      const regioneResidenza = localStorage.getItem("registrazione_regione_residenza");
      const provinciaResidenza = localStorage.getItem("registrazione_provincia_residenza");
      const comuneResidenza = localStorage.getItem("registrazione_comune_residenza");
      
      // Recupera i consensi dal localStorage
      const privacyPolicyConsent = localStorage.getItem("registrazione_privacy_consent") === "true";
      const termsOfServiceConsent = localStorage.getItem("registrazione_terms_consent") === "true";
      const politicalOpinionsConsent = localStorage.getItem("registrazione_political_opinions_consent") === "true";

      // Salva il ruolo automaticamente come "Elettore"
      localStorage.setItem("registrazione_ruolo", "Elettore");

      // Prepara i dati per l'API
      const registrationData = {
        email,
        password,
        nome,
        cognome,
        genere,
        cittadinanza,
        data_nascita: dataNascita,
        paese_residenza: paeseResidenza,
        regione_residenza: regioneResidenza,
        provincia_residenza: provinciaResidenza,
        comune_residenza: comuneResidenza,
        ruolo: "Elettore",
        privacy_policy_consent: privacyPolicyConsent,
        terms_of_service_consent: termsOfServiceConsent,
        political_opinions_consent: politicalOpinionsConsent
      };

      // Debug: verifica i dati che verranno inviati
      console.log('🔍 Dati registrazione:', registrationData);
      console.log('🔍 Campi obbligatori:', {
        email: !!email,
        password: !!password,
        nome: !!nome,
        cognome: !!cognome,
        privacy_policy_consent: privacyPolicyConsent,
        terms_of_service_consent: termsOfServiceConsent
      });

      // L'email è già stata verificata nella fase iniziale
      console.log('🔍 Email da registrare:', email);

      // Chiama l'API di registrazione
      const response = await fetch('https://demos-c7k0.onrender.com/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      console.log('📡 Risposta server:', response.status, response.statusText);
      
      let result;
      const responseText = await response.text();
      console.log('📄 Testo risposta raw:', responseText);
      
      if (responseText) {
        try {
          result = JSON.parse(responseText);
          console.log('📊 Risposta JSON:', result);
        } catch (error) {
          console.error('❌ Errore parsing JSON:', error);
          throw new Error('Risposta del server non valida');
        }
      } else {
        console.log('⚠️ Risposta vuota dal server');
        result = { message: 'Risposta vuota dal server' };
      }

      if (response.ok) {
        // Registrazione completata con successo
        const userId = result.user.id;
        
        // Controlla se ci sono dati CIE da collegare
        const cieDataStr = localStorage.getItem('cie_pending_registration');
        if (cieDataStr) {
          try {
            const cieData = JSON.parse(cieDataStr);
            console.log('🔗 Collegamento fiscal_number CIE all\'account...');
            
            // Collega il fiscal_number all'account appena creato
            const linkResponse = await fetch('https://demos-c7k0.onrender.com/api/auth/cie/link-fiscal-number', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: userId,
                pendingId: cieData.pendingId
              }),
            });
            
            if (linkResponse.ok) {
              const linkResult = await linkResponse.json();
              console.log('✅ Fiscal number collegato:', linkResult);
              
              // Rimuovi i dati CIE temporanei
              localStorage.removeItem('cie_pending_registration');
            } else {
              console.warn('⚠️ Errore collegamento fiscal_number, ma registrazione completata');
              // Non bloccare il flusso se il collegamento fallisce
            }
          } catch (linkError) {
            console.error('❌ Errore collegamento fiscal_number:', linkError);
            // Non bloccare il flusso se il collegamento fallisce
          }
        }
        
        toast({
          title: "Registrazione completata!",
          description: "Controlla la tua email per confermare l'account.",
        });
        
        // Salva l'email dell'utente per la verifica
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_status', 'pending');
        localStorage.setItem('user_id', userId);
        
        // Pulisce i dati di registrazione
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('registrazione_')) {
            localStorage.removeItem(key);
          }
        });
        
        // Reindirizza alla pagina di verifica email
        navigate(`/verifica-email?email=${encodeURIComponent(email)}`);
      } else {
        // Errore nella registrazione (incluso email duplicata)
        toast({
          title: "Errore nella registrazione",
          description: result.message || "Si è verificato un errore. Riprova.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Errore nella registrazione:', error);
      toast({
        title: "Errore",
        description: "Impossibile completare la registrazione. Riprova più tardi.",
        variant: "destructive",
      });
    }
  };

  // Tutti i nuovi utenti sono automaticamente "Elettore" - nessun campo aggiuntivo necessario

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              Completamento Registrazione
            </CardTitle>
            <CardDescription className="text-center">
              Completa la tua registrazione come Elettore
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Informazione Ruolo */}
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🙋‍♂️</span>
                  <div>
                    <div className="font-semibold text-blue-900">Ruolo: Elettore</div>
                    <div className="text-sm text-blue-700 mt-1">Tutti i nuovi utenti vengono registrati automaticamente come Elettore</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pulsante Continua */}
            <div className="flex justify-center pt-6">
              <Button
                onClick={handleComplete}
                className="px-8 py-3 text-white font-semibold text-lg shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  border: "none"
                }}
              >
                Completa Registrazione
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
