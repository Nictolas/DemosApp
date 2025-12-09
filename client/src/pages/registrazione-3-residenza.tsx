import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import { ITALY_DATA } from "@/data/italyData";
import { useToast } from "@/hooks/use-toast";

const residenzaSchema = z.object({
  paese_residenza: z.string().min(1, "Il paese di residenza è obbligatorio"),
  regione_residenza: z.string().min(1, "La regione di residenza è obbligatoria"),
  provincia_residenza: z.string().min(1, "La provincia di residenza è obbligatoria"),
  comune_residenza: z.string().min(1, "Il comune di residenza è obbligatorio"),
});

type ResidenzaValues = z.infer<typeof residenzaSchema>;

export default function RegistrazioneResidenza() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debug: verifica che i dati italiani siano caricati
  console.log("ITALY_DATA caricato:", ITALY_DATA);
  console.log("Regioni disponibili:", ITALY_DATA.Italia.regioni.length);

  const form = useForm<ResidenzaValues>({
    resolver: zodResolver(residenzaSchema),
    defaultValues: {
      paese_residenza: "",
      regione_residenza: "",
      provincia_residenza: "",
      comune_residenza: "",
    },
  });

  const watchPaeseResidenza = form.watch("paese_residenza");
  const watchRegioneResidenza = form.watch("regione_residenza");
  const watchProvinciaResidenza = form.watch("provincia_residenza");

  // Debug: verifica i valori dei campi
  console.log("Paese selezionato:", watchPaeseResidenza);
  console.log("Regione selezionata:", watchRegioneResidenza);
  console.log("Provincia selezionata:", watchProvinciaResidenza);

  const completeRegistration = async () => {
    try {
      setIsSubmitting(true);

      // Recupera tutti i dati già salvati nei passaggi precedenti
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
      
      // Debug: verifica che i dati essenziali siano presenti
      console.log('🔍 DEBUG registrazione - Dati recuperati dal localStorage:', {
        email: !!email,
        password: !!password,
        nome: !!nome,
        cognome: !!cognome,
        genere: genere,
        cittadinanza: cittadinanza,
        paese_residenza: paeseResidenza,
        regione_residenza: regioneResidenza,
        provincia_residenza: provinciaResidenza,
        comune_residenza: comuneResidenza
      });
      
      // Verifica che i dati essenziali siano presenti
      if (!genere || !cittadinanza || !paeseResidenza) {
        console.error('❌ Dati mancanti:', { genere, cittadinanza, paeseResidenza });
        toast({
          title: "Dati incompleti",
          description: "Alcuni dati obbligatori sono mancanti. Per favore, torna indietro e completa tutti i campi.",
          variant: "destructive",
        });
        return;
      }

      // Recupera i consensi salvati all'inizio del flow
      const privacyPolicyConsent = localStorage.getItem("registrazione_privacy_consent") === "true";
      const termsOfServiceConsent = localStorage.getItem("registrazione_terms_consent") === "true";
      const politicalOpinionsConsent = localStorage.getItem("registrazione_political_opinions_consent") === "true";

      // Imposta ruolo di default per tutti i nuovi utenti
      localStorage.setItem("registrazione_ruolo", "Elettore");

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

      const response = await fetch('https://demos-c7k0.onrender.com/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData),
      });

      const responseText = await response.text();
      let result;
      if (responseText) {
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error('❌ Errore parsing JSON:', parseError);
          throw new Error('Risposta del server non valida');
        }
      } else {
        result = { message: 'Risposta vuota dal server' };
      }

      if (response.ok) {
        const userId = result.user?.id;

        // Collega eventuale fiscal_number da CIE se presente
        const cieDataStr = localStorage.getItem('cie_pending_registration');
        if (cieDataStr && userId) {
          try {
            const cieData = JSON.parse(cieDataStr);
            await fetch('https://demos-c7k0.onrender.com/api/auth/cie/link-fiscal-number', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, pendingId: cieData.pendingId }),
            });
            localStorage.removeItem('cie_pending_registration');
          } catch (linkError) {
            console.warn('⚠️ Collegamento fiscal_number non riuscito, ma registrazione completata', linkError);
          }
        }

        toast({
          title: "Registrazione completata!",
          description: "Controlla la tua email per confermare l'account.",
        });

        // Salva info utente e pulizia
        if (email) localStorage.setItem('user_email', email);
        if (userId) localStorage.setItem('user_id', userId);
        localStorage.setItem('user_status', 'pending');

        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('registrazione_')) {
            localStorage.removeItem(key);
          }
        });

        navigate(`/verifica-email${email ? `?email=${encodeURIComponent(email)}` : ''}`);
      } else {
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (data: ResidenzaValues) => {
    // Salva i dati nel localStorage
    localStorage.setItem("registrazione_paese_residenza", data.paese_residenza);
    localStorage.setItem("registrazione_regione_residenza", data.regione_residenza);
    localStorage.setItem("registrazione_provincia_residenza", data.provincia_residenza);
    localStorage.setItem("registrazione_comune_residenza", data.comune_residenza);
    
    // Completa direttamente la registrazione impostando il ruolo a Elettore
    await completeRegistration();
  };

  // Reset dei campi dipendenti
  React.useEffect(() => {
    if (watchPaeseResidenza !== "it") {
      form.setValue("regione_residenza", "");
      form.setValue("provincia_residenza", "");
      form.setValue("comune_residenza", "");
    }
  }, [watchPaeseResidenza, form]);

  React.useEffect(() => {
    if (watchRegioneResidenza) {
      form.setValue("provincia_residenza", "");
      form.setValue("comune_residenza", "");
    }
  }, [watchRegioneResidenza, form]);

  React.useEffect(() => {
    if (watchProvinciaResidenza) {
      form.setValue("comune_residenza", "");
    }
  }, [watchProvinciaResidenza, form]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
          
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="paese_residenza"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paese di Residenza *</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Seleziona paese</option>
                      <option value="it">Italia</option>
                      <option value="Francia">Francia</option>
                      <option value="Germania">Germania</option>
                      <option value="Spagna">Spagna</option>
                      <option value="Regno Unito">Regno Unito</option>
                      <option value="altro">Altro</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchPaeseResidenza === "it" && (
              <>
                <FormField
                  control={form.control}
                  name="regione_residenza"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regione di Residenza *</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Seleziona regione</option>
                          {ITALY_DATA.Italia.regioni.map((regione) => (
                            <option key={regione.nome} value={regione.nome}>
                              {regione.nome}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                                 {watchRegioneResidenza && (
                   <FormField
                     control={form.control}
                     name="provincia_residenza"
                     render={({ field }) => {
                       const regioniTrovate = ITALY_DATA.Italia.regioni.find((r) => r.nome === watchRegioneResidenza);
                       const provinceDisponibili = regioniTrovate?.province || [];
                       
                       console.log("Regione trovata:", regioniTrovate);
                       console.log("Province disponibili:", provinceDisponibili);
                       
                       return (
                         <FormItem>
                           <FormLabel>Provincia di Residenza *</FormLabel>
                           <FormControl>
                             <select
                               {...field}
                               className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                             >
                               <option value="">Seleziona provincia</option>
                               {provinceDisponibili.map((provincia) => (
                                 <option key={provincia.nome} value={provincia.nome}>
                                   {provincia.nome}
                                 </option>
                               ))}
                             </select>
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       );
                     }}
                   />
                 )}

                {watchProvinciaResidenza && (
                  <FormField
                    control={form.control}
                    name="comune_residenza"
                    render={({ field }) => {
                      const regioniTrovate = ITALY_DATA.Italia.regioni.find((r) => r.nome === watchRegioneResidenza);
                      const provinceTrovate = regioniTrovate?.province.find((p) => p.nome === watchProvinciaResidenza);
                      const comuniDisponibili = provinceTrovate?.comuni || [];
                      
                      console.log("Regione per comuni:", regioniTrovate);
                      console.log("Provincia per comuni:", provinceTrovate);
                      console.log("Comuni disponibili:", comuniDisponibili);
                      
                      return (
                        <FormItem>
                          <FormLabel>Comune di Residenza *</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="">Seleziona comune</option>
                              {comuniDisponibili.map((comune) => (
                                <option key={comune} value={comune}>
                                  {comune}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                )}
              </>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Registrazione in corso..." : "Completa Registrazione"}
            </Button>
          </form>
        </Form>

                 <div className="text-center mt-6 space-y-2">
           <Button
             variant="ghost"
             onClick={() => navigate("/registrazione-data-nascita")}
             className="text-gray-500 hover:text-gray-700"
           >
             ← Indietro
           </Button>
         </div>
      </div>
    </div>
  );
}
