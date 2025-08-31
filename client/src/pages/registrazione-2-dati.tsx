import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";

const datiSchema = z.object({
  ruolo: z.string().min(1, "Il ruolo è obbligatorio"),
  grado_elezione: z.string().optional(),
  paese_elezione: z.string().optional(),
  regione_elezione: z.string().optional(),
  provincia_elezione: z.string().optional(),
  comune_elezione: z.string().optional(),
  grado_candidatura: z.string().optional(),
  paese_candidatura: z.string().optional(),
  regione_candidatura: z.string().optional(),
  provincia_candidatura: z.string().optional(),
  comune_candidatura: z.string().optional(),
}).refine((data) => {
  // Validazione condizionale in base al ruolo
  if (data.ruolo === "politico" || data.ruolo === "candidato_politico") {
    return data.grado_elezione && data.paese_elezione && data.regione_elezione && data.provincia_elezione && data.comune_elezione;
  }
  if (data.ruolo === "candidato" || data.ruolo === "candidato_politico") {
    return data.grado_candidatura && data.paese_candidatura && data.regione_candidatura && data.provincia_candidatura && data.comune_candidatura;
  }
  return true; // "elettore" non richiede campi aggiuntivi
}, {
  message: "Compila tutti i campi richiesti per il ruolo selezionato",
  path: ["ruolo"]
});

type DatiValues = z.infer<typeof datiSchema>;

export default function RegistrazioneDati() {
  const [, navigate] = useLocation();

  const form = useForm<DatiValues>({
    resolver: zodResolver(datiSchema),
    defaultValues: {
      ruolo: "",
      grado_elezione: "",
      paese_elezione: "",
      regione_elezione: "",
      provincia_elezione: "",
      comune_elezione: "",
      grado_candidatura: "",
      paese_candidatura: "",
      regione_candidatura: "",
      provincia_candidatura: "",
      comune_candidatura: "",
    },
  });

  const selectedRole = form.watch("ruolo");

  const onSubmit = async (data: DatiValues) => {
    try {
      console.log('🚀 REGISTRAZIONE - Invio dati completi al server...');
      
      // Raccogli tutti i dati dal localStorage
      const email = localStorage.getItem("registrazione_email");
      const password = localStorage.getItem("registrazione_password");
      const nome = localStorage.getItem("registrazione_nome");
      const cognome = localStorage.getItem("registrazione_cognome");
      const genere = localStorage.getItem("registrazione_genere");
      const data_nascita = localStorage.getItem("registrazione_data_nascita");
      const cittadinanza = localStorage.getItem("registrazione_cittadinanza");
      const paese_residenza = localStorage.getItem("registrazione_paese_residenza");
      const regione_residenza = localStorage.getItem("registrazione_regione_residenza");
      const provincia_residenza = localStorage.getItem("registrazione_provincia_residenza");
      const comune_residenza = localStorage.getItem("registrazione_comune_residenza");
      const codice_fiscale = localStorage.getItem("registrazione_codice_fiscale");

      if (!email || !password || !nome || !cognome) {
        console.error('❌ Dati mancanti per la registrazione:', { email: !!email, password: !!password, nome: !!nome, cognome: !!cognome });
        alert('Dati mancanti per la registrazione. Torna alla prima pagina.');
        return;
      }

      // Prepara i dati per l'API
      const userData = {
        email,
        password,
        nome,
        cognome,
        genere,
        data_nascita,
        cittadinanza,
        paese_residenza,
        regione_residenza,
        provincia_residenza,
        comune_residenza,
        codice_fiscale,
        ruolo: data.ruolo,
        grado_elezione: data.grado_elezione,
        paese_elezione: data.paese_elezione,
        regione_elezione: data.regione_elezione,
        provincia_elezione: data.provincia_elezione,
        comune_elezione: data.comune_elezione,
        grado_candidatura: data.grado_candidatura,
        paese_candidatura: data.paese_candidatura,
        regione_candidatura: data.regione_candidatura,
        provincia_candidatura: data.provincia_candidatura,
        comune_candidatura: data.comune_candidatura
      };

      console.log('📤 Invio dati al server:', userData);

      // Chiama l'endpoint di registrazione
      const response = await fetch('https://demos-c7k0.onrender.com/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Registrazione completata:', result);

      // Salva il token nel localStorage
      if (result.token) {
        localStorage.setItem('auth_token', result.token);
        localStorage.setItem('user_id', result.user.id);
        console.log('🎫 Token salvato, utente autenticato');
      }

      // Pulisci i dati temporanei
      const keysToRemove = [
        'registrazione_email', 'registrazione_password', 'registrazione_nome', 'registrazione_cognome',
        'registrazione_genere', 'registrazione_data_nascita', 'registrazione_cittadinanza',
        'registrazione_paese_residenza', 'registrazione_regione_residenza', 'registrazione_provincia_residenza',
        'registrazione_comune_residenza', 'registrazione_codice_fiscale', 'registrazione_ruolo',
        'registrazione_grado_elezione', 'registrazione_paese_elezione', 'registrazione_regione_elezione',
        'registrazione_provincia_elezione', 'registrazione_comune_elezione', 'registrazione_grado_candidatura',
        'registrazione_paese_candidatura', 'registrazione_regione_candidatura', 'registrazione_provincia_candidatura',
        'registrazione_comune_candidatura'
      ];
      
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Vai al menu principale
      navigate("/menu");

    } catch (error) {
      console.error('💥 Errore durante la registrazione:', error);
      alert(`Errore durante la registrazione: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Quale ruolo vuoi ricoprire?
          </h2>
          <p className="text-gray-600 text-sm">
            Scegli il tuo ruolo nella piattaforma
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="ruolo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ruolo *</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="w-full h-12 text-lg text-center border rounded-md"
                    >
                      <option value="">Seleziona ruolo</option>
                      <option value="elettore">Elettore</option>
                      <option value="politico">Politico</option>
                      <option value="candidato">Candidato</option>
                      <option value="candidato_politico">Candidato Politico</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campi dinamici per Grado di Elezione e Paese di Elezione */}
            {/* "Politico" e "Candidato Politico" mostrano i dati di elezione */}
            {(selectedRole === "politico" || selectedRole === "candidato_politico") && (
              <>
                <FormField
                  control={form.control}
                  name="grado_elezione"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grado di Elezione *</FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-1 gap-3">
                          <Button
                            type="button"
                            variant={field.value === "europeo" ? "default" : "outline"}
                            className={`h-12 text-lg justify-start ${field.value === "europeo" ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
                            onClick={() => field.onChange("europeo")}
                          >
                            <span className="mr-3 text-xl">🌍</span>
                            Europeo
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === "nazionale" ? "default" : "outline"}
                            className={`h-12 text-lg justify-start ${field.value === "nazionale" ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
                            onClick={() => field.onChange("nazionale")}
                          >
                            <span className="mr-3 text-xl">🏛️</span>
                            Nazionale
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === "regionale" ? "default" : "outline"}
                            className={`h-12 text-lg justify-start ${field.value === "regionale" ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
                            onClick={() => field.onChange("regionale")}
                          >
                            <span className="mr-3 text-xl">🗺️</span>
                            Regionale
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === "provinciale" ? "default" : "outline"}
                            className={`h-12 text-lg justify-start ${field.value === "provinciale" ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
                            onClick={() => field.onChange("provinciale")}
                          >
                            <span className="mr-3 text-xl">📍</span>
                            Provinciale
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === "comunale" ? "default" : "outline"}
                            className={`h-12 text-lg justify-start ${field.value === "comunale" ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
                            onClick={() => field.onChange("comunale")}
                          >
                            <span className="mr-3 text-xl">🏡</span>
                            Comunale
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                                  <FormField
                    control={form.control}
                    name="paese_elezione"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paese di Elezione *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full h-12 text-lg text-center border rounded-md"
                          >
                            <option value="">Seleziona paese di elezione</option>
                            <option value="Italia">Italia</option>
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

                  {/* Campi geografici per Elezione (solo se Paese = Italia) */}
                  {form.watch("paese_elezione") === "Italia" && (
                    <>
                      <FormField
                        control={form.control}
                        name="regione_elezione"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Regione di Elezione *</FormLabel>
                            <FormControl>
                              <select
                                {...field}
                                className="w-full h-12 text-lg text-center border rounded-md"
                              >
                                <option value="">Seleziona regione</option>
                                <option value="Abruzzo">Abruzzo</option>
                                <option value="Basilicata">Basilicata</option>
                                <option value="Calabria">Calabria</option>
                                <option value="Campania">Campania</option>
                                <option value="Emilia-Romagna">Emilia-Romagna</option>
                                <option value="Friuli-Venezia Giulia">Friuli-Venezia Giulia</option>
                                <option value="Lazio">Lazio</option>
                                <option value="Liguria">Liguria</option>
                                <option value="Lombardia">Lombardia</option>
                                <option value="Marche">Marche</option>
                                <option value="Molise">Molise</option>
                                <option value="Piemonte">Piemonte</option>
                                <option value="Puglia">Puglia</option>
                                <option value="Sardegna">Sardegna</option>
                                <option value="Sicilia">Sicilia</option>
                                <option value="Toscana">Toscana</option>
                                <option value="Trentino-Alto Adige">Trentino-Alto Adige</option>
                                <option value="Umbria">Umbria</option>
                                <option value="Valle d'Aosta">Valle d'Aosta</option>
                                <option value="Veneto">Veneto</option>
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="provincia_elezione"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Provincia di Elezione *</FormLabel>
                            <FormControl>
                              <select
                                {...field}
                                className="w-full h-12 text-lg text-center border rounded-md"
                                disabled={!form.watch("regione_elezione")}
                              >
                                <option value="">Seleziona provincia</option>
                                {form.watch("regione_elezione") === "Toscana" && (
                                  <>
                                    <option value="Arezzo">Arezzo</option>
                                    <option value="Firenze">Firenze</option>
                                    <option value="Grosseto">Grosseto</option>
                                    <option value="Livorno">Livorno</option>
                                    <option value="Lucca">Lucca</option>
                                    <option value="Massa-Carrara">Massa-Carrara</option>
                                    <option value="Pisa">Pisa</option>
                                    <option value="Pistoia">Pistoia</option>
                                    <option value="Prato">Prato</option>
                                    <option value="Siena">Siena</option>
                                  </>
                                )}
                                {/* Altre regioni possono essere aggiunte qui */}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="comune_elezione"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Comune di Elezione *</FormLabel>
                            <FormControl>
                              <select
                                {...field}
                                className="w-full h-12 text-lg text-center border rounded-md"
                                disabled={!form.watch("provincia_elezione")}
                              >
                                <option value="">Seleziona comune</option>
                                {form.watch("provincia_elezione") === "Pisa" && (
                                  <>
                                    <option value="Bientina">Bientina</option>
                                    <option value="Buti">Buti</option>
                                    <option value="Calci">Calci</option>
                                    <option value="Calcinaia">Calcinaia</option>
                                    <option value="Capannoli">Capannoli</option>
                                    <option value="Casale Marittimo">Casale Marittimo</option>
                                    <option value="Casciana Terme Lari">Casciana Terme Lari</option>
                                    <option value="Cascina">Cascina</option>
                                    <option value="Castelfranco di Sotto">Castelfranco di Sotto</option>
                                    <option value="Castellina Marittima">Castellina Marittima</option>
                                    <option value="Castelnuovo di Val di Cecina">Castelnuovo di Val di Cecina</option>
                                    <option value="Chianni">Chianni</option>
                                    <option value="Crespina Lorenzana">Crespina Lorenzana</option>
                                    <option value="Fauglia">Fauglia</option>
                                    <option value="Guardistallo">Guardistallo</option>
                                    <option value="Lajatico">Lajatico</option>
                                    <option value="Montecatini Val di Cecina">Montecatini Val di Cecina</option>
                                    <option value="Montescudaio">Montescudaio</option>
                                    <option value="Monteverdi Marittimo">Monteverdi Marittimo</option>
                                    <option value="Montopoli in Val d'Arno">Montopoli in Val d'Arno</option>
                                    <option value="Orciano Pisano">Orciano Pisano</option>
                                    <option value="Palaia">Palaia</option>
                                    <option value="Peccioli">Peccioli</option>
                                    <option value="Pisa">Pisa</option>
                                    <option value="Pomarance">Pomarance</option>
                                    <option value="Ponsacco">Ponsacco</option>
                                    <option value="Pontedera">Pontedera</option>
                                    <option value="Riparbella">Riparbella</option>
                                    <option value="San Giuliano Terme">San Giuliano Terme</option>
                                    <option value="San Miniato">San Miniato</option>
                                    <option value="Santa Croce sull'Arno">Santa Croce sull'Arno</option>
                                    <option value="Santa Luce">Santa Luce</option>
                                    <option value="Santa Maria a Monte">Santa Maria a Monte</option>
                                    <option value="Terricciola">Terricciola</option>
                                    <option value="Vecchiano">Vecchiano</option>
                                    <option value="Vicopisano">Vicopisano</option>
                                    <option value="Volterra">Volterra</option>
                                  </>
                                )}
                                {/* Altri comuni possono essere aggiunti qui */}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
              </>
            )}

            {/* Campi dinamici per Grado di Candidatura e Paese di Candidatura */}
            {/* "Candidato" e "Candidato Politico" mostrano i dati di candidatura */}
            {(selectedRole === "candidato" || selectedRole === "candidato_politico") && (
              <>
                <FormField
                  control={form.control}
                  name="grado_candidatura"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grado di Candidatura *</FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-1 gap-3">
                          <Button
                            type="button"
                            variant={field.value === "europeo" ? "default" : "outline"}
                            className={`h-12 text-lg justify-start ${field.value === "europeo" ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
                            onClick={() => field.onChange("europeo")}
                          >
                            <span className="mr-3 text-xl">🌍</span>
                            Europeo
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === "nazionale" ? "default" : "outline"}
                            className={`h-12 text-lg justify-start ${field.value === "nazionale" ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
                            onClick={() => field.onChange("nazionale")}
                          >
                            <span className="mr-3 text-xl">🏛️</span>
                            Nazionale
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === "regionale" ? "default" : "outline"}
                            className={`h-12 text-lg justify-start ${field.value === "regionale" ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
                            onClick={() => field.onChange("regionale")}
                          >
                            <span className="mr-3 text-xl">🗺️</span>
                            Regionale
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === "provinciale" ? "default" : "outline"}
                            className={`h-12 text-lg justify-start ${field.value === "provinciale" ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
                            onClick={() => field.onChange("provinciale")}
                          >
                            <span className="mr-3 text-xl">📍</span>
                            Provinciale
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === "comunale" ? "default" : "outline"}
                            className={`h-12 text-lg justify-start ${field.value === "comunale" ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
                            onClick={() => field.onChange("comunale")}
                          >
                            <span className="mr-3 text-xl">🏡</span>
                            Comunale
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                                  <FormField
                    control={form.control}
                    name="paese_candidatura"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paese di Candidatura *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full h-12 text-lg text-center border rounded-md"
                          >
                            <option value="">Seleziona paese di candidatura</option>
                            <option value="Italia">Italia</option>
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

                  {/* Campi geografici per Candidatura (solo se Paese = Italia) */}
                  {form.watch("paese_candidatura") === "Italia" && (
                    <>
                      <FormField
                        control={form.control}
                        name="regione_candidatura"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Regione di Candidatura *</FormLabel>
                            <FormControl>
                              <select
                                {...field}
                                className="w-full h-12 text-lg text-center border rounded-md"
                              >
                                <option value="">Seleziona regione</option>
                                <option value="Abruzzo">Abruzzo</option>
                                <option value="Basilicata">Basilicata</option>
                                <option value="Calabria">Calabria</option>
                                <option value="Campania">Campania</option>
                                <option value="Emilia-Romagna">Emilia-Romagna</option>
                                <option value="Friuli-Venezia Giulia">Friuli-Venezia Giulia</option>
                                <option value="Lazio">Lazio</option>
                                <option value="Liguria">Liguria</option>
                                <option value="Lombardia">Lombardia</option>
                                <option value="Marche">Marche</option>
                                <option value="Molise">Molise</option>
                                <option value="Piemonte">Piemonte</option>
                                <option value="Puglia">Puglia</option>
                                <option value="Sardegna">Sardegna</option>
                                <option value="Sicilia">Sicilia</option>
                                <option value="Toscana">Toscana</option>
                                <option value="Trentino-Alto Adige">Trentino-Alto Adige</option>
                                <option value="Umbria">Umbria</option>
                                <option value="Valle d'Aosta">Valle d'Aosta</option>
                                <option value="Veneto">Veneto</option>
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="provincia_candidatura"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Provincia di Candidatura *</FormLabel>
                            <FormControl>
                              <select
                                {...field}
                                className="w-full h-12 text-lg text-center border rounded-md"
                                disabled={!form.watch("regione_candidatura")}
                              >
                                <option value="">Seleziona provincia</option>
                                {form.watch("regione_candidatura") === "Toscana" && (
                                  <>
                                    <option value="Arezzo">Arezzo</option>
                                    <option value="Firenze">Firenze</option>
                                    <option value="Grosseto">Grosseto</option>
                                    <option value="Livorno">Livorno</option>
                                    <option value="Lucca">Lucca</option>
                                    <option value="Massa-Carrara">Massa-Carrara</option>
                                    <option value="Pisa">Pisa</option>
                                    <option value="Pistoia">Pistoia</option>
                                    <option value="Prato">Prato</option>
                                    <option value="Siena">Siena</option>
                                  </>
                                )}
                                {/* Altre regioni possono essere aggiunte qui */}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="comune_candidatura"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Comune di Candidatura *</FormLabel>
                            <FormControl>
                              <select
                                {...field}
                                className="w-full h-12 text-lg text-center border rounded-md"
                                disabled={!form.watch("provincia_candidatura")}
                              >
                                <option value="">Seleziona comune</option>
                                {form.watch("provincia_candidatura") === "Pisa" && (
                                  <>
                                    <option value="Bientina">Bientina</option>
                                    <option value="Buti">Buti</option>
                                    <option value="Calci">Calci</option>
                                    <option value="Calcinaia">Calcinaia</option>
                                    <option value="Capannoli">Capannoli</option>
                                    <option value="Casale Marittimo">Casale Marittimo</option>
                                    <option value="Casciana Terme Lari">Casciana Terme Lari</option>
                                    <option value="Cascina">Cascina</option>
                                    <option value="Castelfranco di Sotto">Castelfranco di Sotto</option>
                                    <option value="Castellina Marittima">Castellina Marittima</option>
                                    <option value="Castelnuovo di Val di Cecina">Castelnuovo di Val di Cecina</option>
                                    <option value="Chianni">Chianni</option>
                                    <option value="Crespina Lorenzana">Crespina Lorenzana</option>
                                    <option value="Fauglia">Fauglia</option>
                                    <option value="Guardistallo">Guardistallo</option>
                                    <option value="Lajatico">Lajatico</option>
                                    <option value="Montecatini Val di Cecina">Montecatini Val di Cecina</option>
                                    <option value="Montescudaio">Montescudaio</option>
                                    <option value="Monteverdi Marittimo">Monteverdi Marittimo</option>
                                    <option value="Montopoli in Val d'Arno">Montopoli in Val d'Arno</option>
                                    <option value="Orciano Pisano">Orciano Pisano</option>
                                    <option value="Palaia">Palaia</option>
                                    <option value="Peccioli">Peccioli</option>
                                    <option value="Pisa">Pisa</option>
                                    <option value="Pomarance">Pomarance</option>
                                    <option value="Ponsacco">Ponsacco</option>
                                    <option value="Pontedera">Pontedera</option>
                                    <option value="Riparbella">Riparbella</option>
                                    <option value="San Giuliano Terme">San Giuliano Terme</option>
                                    <option value="San Miniato">San Miniato</option>
                                    <option value="Santa Croce sull'Arno">Santa Croce sull'Arno</option>
                                    <option value="Santa Luce">Santa Luce</option>
                                    <option value="Santa Maria a Monte">Santa Maria a Monte</option>
                                    <option value="Terricciola">Terricciola</option>
                                    <option value="Vecchiano">Vecchiano</option>
                                    <option value="Vicopisano">Vicopisano</option>
                                    <option value="Volterra">Volterra</option>
                                  </>
                                )}
                                {/* Altri comuni possono essere aggiunti qui */}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
              </>
            )}

            {/* "Elettore" non mostra altri campi - solo il ruolo */}

            <Button type="submit" className="w-full h-12 text-lg">
              Continua
            </Button>
          </form>
        </Form>

        <div className="text-center mt-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/registrazione-3-residenza")}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
