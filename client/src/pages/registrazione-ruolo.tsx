import React, { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ITALY_DATA } from "@/data/italyData";
import { useToast } from "@/hooks/use-toast";

export default function RegistrazioneRuolo() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedRuolo, setSelectedRuolo] = useState("");
  const [paeseElezione, setPaeseElezione] = useState("");
  const [regioneElezione, setRegioneElezione] = useState("");
  const [provinciaElezione, setProvinciaElezione] = useState("");
  const [comuneElezione, setComuneElezione] = useState("");
  const [paeseCandidatura, setPaeseCandidatura] = useState("");
  const [regioneCandidatura, setRegioneCandidatura] = useState("");
  const [provinciaCandidatura, setProvinciaCandidatura] = useState("");
  const [comuneCandidatura, setComuneCandidatura] = useState("");
  const [gradoElezione, setGradoElezione] = useState("");
  const [gradoCandidatura, setGradoCandidatura] = useState("");

  const ruoli = [
    { id: "Elettore", nome: "Elettore", descrizione: "Cittadino che può votare", emoji: "🙋‍♂️" },
    { id: "Politico", nome: "Politico", descrizione: "Rappresentante politico", emoji: "👔" },
    { id: "Candidato", nome: "Candidato", descrizione: "Cittadino candidato alle elezioni", emoji: "🗳️" },
    { id: "Candidato Politico", nome: "Candidato Politico", descrizione: "Politico candidato alle elezioni", emoji: "🔄" }
  ];

  const gradiElezione = [
    { id: "europeo", nome: "Europeo" },
    { id: "camera", nome: "Camera" },
    { id: "senato", nome: "Senato" },
    { id: "regionale", nome: "Regionale" },
    { id: "comunale", nome: "Comunale" }
  ];

  const gradiCandidatura = [
    { id: "europeo", nome: "Europeo" },
    { id: "camera", nome: "Camera" },
    { id: "senato", nome: "Senato" },
    { id: "regionale", nome: "Regionale" },
    { id: "comunale", nome: "Comunale" }
  ];

  const handleRuoloSelect = (ruolo: string) => {
    console.log('🎯 Ruolo selezionato:', ruolo);
    setSelectedRuolo(ruolo);
  };

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

      // Salva i dati del ruolo
      localStorage.setItem("registrazione_ruolo", selectedRuolo);
      if (paeseElezione) localStorage.setItem("registrazione_paese_elezione", paeseElezione);
      if (regioneElezione) localStorage.setItem("registrazione_regione_elezione", regioneElezione);
      if (provinciaElezione) localStorage.setItem("registrazione_provincia_elezione", provinciaElezione);
      if (comuneElezione) localStorage.setItem("registrazione_comune_elezione", comuneElezione);
      if (paeseCandidatura) localStorage.setItem("registrazione_paese_candidatura", paeseCandidatura);
      if (regioneCandidatura) localStorage.setItem("registrazione_regione_candidatura", regioneCandidatura);
      if (provinciaCandidatura) localStorage.setItem("registrazione_provincia_candidatura", provinciaCandidatura);
      if (comuneCandidatura) localStorage.setItem("registrazione_comune_candidatura", comuneCandidatura);
      if (gradoElezione) localStorage.setItem("registrazione_grado_elezione", gradoElezione);
      if (gradoCandidatura) localStorage.setItem("registrazione_grado_candidatura", gradoCandidatura);

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
        ruolo: selectedRuolo,
        grado_elezione: gradoElezione,
        paese_elezione: paeseElezione,
        regione_elezione: regioneElezione,
        provincia_elezione: provinciaElezione,
        comune_elezione: comuneElezione,
        grado_candidatura: gradoCandidatura,
        paese_candidatura: paeseCandidatura,
        regione_candidatura: regioneCandidatura,
        provincia_candidatura: provinciaCandidatura,
        comune_candidatura: comuneCandidatura,
        privacy_policy_consent: privacyPolicyConsent,
        terms_of_service_consent: termsOfServiceConsent
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
        toast({
          title: "Registrazione completata!",
          description: "Controlla la tua email per confermare l'account.",
        });
        
        // Salva l'email dell'utente per la verifica
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_status', 'pending');
        localStorage.setItem('user_id', result.user.id);
        
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

  const showElezioneFields = selectedRuolo === "P" || selectedRuolo === "Candidato Politico";
  const showCandidaturaFields = selectedRuolo === "C" || selectedRuolo === "Candidato Politico";

  // Reset dei campi dipendenti quando cambia il paese elezione
  React.useEffect(() => {
    if (paeseElezione !== "it") {
      setRegioneElezione("");
      setProvinciaElezione("");
      setComuneElezione("");
    }
  }, [paeseElezione]);

  // Reset dei campi dipendenti quando cambia la regione elezione
  React.useEffect(() => {
    if (regioneElezione) {
      setProvinciaElezione("");
      setComuneElezione("");
    }
  }, [regioneElezione]);

  // Reset dei campi dipendenti quando cambia la provincia elezione
  React.useEffect(() => {
    if (provinciaElezione) {
      setComuneElezione("");
    }
  }, [provinciaElezione]);

  // Reset dei campi dipendenti quando cambia il paese candidatura
  React.useEffect(() => {
    if (paeseCandidatura !== "it") {
      setRegioneCandidatura("");
      setProvinciaCandidatura("");
      setComuneCandidatura("");
    }
  }, [paeseCandidatura]);

  // Reset dei campi dipendenti quando cambia la regione candidatura
  React.useEffect(() => {
    if (regioneCandidatura) {
      setProvinciaCandidatura("");
      setComuneCandidatura("");
    }
  }, [regioneCandidatura]);

  // Reset dei campi dipendenti quando cambia la provincia candidatura
  React.useEffect(() => {
    if (provinciaCandidatura) {
      setComuneCandidatura("");
    }
  }, [provinciaCandidatura]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              Registrazione - Ruolo e Candidature
            </CardTitle>
            <CardDescription className="text-center">
              Seleziona il tuo ruolo e completa le informazioni richieste
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Selezione Ruolo */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Ruolo *</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ruoli.map((ruolo, index) => {
                  const colorClasses = [
                    "bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300", // Giallo
                    "bg-pink-100 hover:bg-pink-200 text-pink-800 border-pink-300", // Rosa  
                    "bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300", // Blu
                    "bg-green-100 hover:bg-green-200 text-green-800 border-green-300"  // Verde
                  ];
                  const selectedColorClasses = [
                    "bg-yellow-200 text-yellow-900 border-yellow-400", // Giallo selezionato
                    "bg-pink-200 text-pink-900 border-pink-400", // Rosa selezionato
                    "bg-blue-200 text-blue-900 border-blue-400", // Blu selezionato  
                    "bg-green-200 text-green-900 border-green-400"  // Verde selezionato
                  ];
                  
                  const isSelected = selectedRuolo === ruolo.id;
                  const colorClass = isSelected ? selectedColorClasses[index] : colorClasses[index];
                  
                  return (
                    <Button
                      key={ruolo.id}
                      variant="outline"
                      className={`h-auto p-4 text-left justify-start transition-all duration-200 border-2 ${colorClass} ${
                        isSelected ? "shadow-lg transform scale-105" : "hover:shadow-md hover:scale-102"
                      }`}
                      onClick={() => handleRuoloSelect(ruolo.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{ruolo.emoji}</span>
                        <div>
                          <div className="font-semibold">{ruolo.nome}</div>
                          <div className="text-sm opacity-80 mt-1">{ruolo.descrizione}</div>
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Sezione Elezione - visibile solo per "Politico" e "Candidato Politico" */}
            {showElezioneFields && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Luogo di Elezione</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Paese</label>
                    <select
                      value={paeseElezione}
                      onChange={(e) => setPaeseElezione(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Seleziona paese</option>
                      <option value="it">Italia</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Grado Elezione</label>
                    <select
                      value={gradoElezione}
                      onChange={(e) => setGradoElezione(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Seleziona grado</option>
                      {gradiElezione.map((grado) => (
                        <option key={grado.id} value={grado.id}>
                          {grado.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {paeseElezione === "it" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Regione</label>
                      <select
                        value={regioneElezione}
                        onChange={(e) => {
                          console.log('🌍 Regione elezione selezionata:', e.target.value);
                          setRegioneElezione(e.target.value);
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Seleziona regione</option>
                        {ITALY_DATA.Italia.regioni.map((regione) => (
                          <option key={regione.nome} value={regione.nome}>
                            {regione.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Provincia</label>
                      <select
                        value={provinciaElezione}
                        onChange={(e) => setProvinciaElezione(e.target.value)}
                        disabled={!regioneElezione}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Seleziona provincia</option>
                        {regioneElezione && ITALY_DATA.Italia.regioni
                          .find(r => r.nome === regioneElezione)
                          ?.province.map((provincia) => (
                            <option key={provincia.nome} value={provincia.nome}>
                              {provincia.nome}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Comune</label>
                      <select
                        value={comuneElezione}
                        onChange={(e) => setComuneElezione(e.target.value)}
                        disabled={!provinciaElezione}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Seleziona comune</option>
                        {provinciaElezione && ITALY_DATA.Italia.regioni
                          .find(r => r.nome === regioneElezione)
                          ?.province.find(p => p.nome === provinciaElezione)
                          ?.comuni.map((comune) => (
                            <option key={comune} value={comune}>
                              {comune}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sezione Candidatura - visibile solo per "Candidato" e "Candidato Politico" */}
            {showCandidaturaFields && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Luogo di Candidatura</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Paese</label>
                    <select
                      value={paeseCandidatura}
                      onChange={(e) => setPaeseCandidatura(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Seleziona paese</option>
                      <option value="it">Italia</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Grado Candidatura</label>
                    <select
                      value={gradoCandidatura}
                      onChange={(e) => setGradoCandidatura(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Seleziona grado</option>
                      {gradiCandidatura.map((grado) => (
                        <option key={grado.id} value={grado.id}>
                          {grado.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {paeseCandidatura === "it" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Regione</label>
                      <select
                        value={regioneCandidatura}
                        onChange={(e) => {
                          console.log('🏛️ Regione candidatura selezionata:', e.target.value);
                          setRegioneCandidatura(e.target.value);
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Seleziona regione</option>
                        {ITALY_DATA.Italia.regioni.map((regione) => (
                          <option key={regione.nome} value={regione.nome}>
                            {regione.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Provincia</label>
                      <select
                        value={provinciaCandidatura}
                        onChange={(e) => setProvinciaCandidatura(e.target.value)}
                        disabled={!regioneCandidatura}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Seleziona provincia</option>
                        {regioneCandidatura && ITALY_DATA.Italia.regioni
                          .find(r => r.nome === regioneCandidatura)
                          ?.province.map((provincia) => (
                            <option key={provincia.nome} value={provincia.nome}>
                              {provincia.nome}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Comune</label>
                      <select
                        value={comuneCandidatura}
                        onChange={(e) => setComuneCandidatura(e.target.value)}
                        disabled={!provinciaCandidatura}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Seleziona comune</option>
                        {provinciaCandidatura && ITALY_DATA.Italia.regioni
                          .find(r => r.nome === regioneCandidatura)
                          ?.province.find(p => p.nome === provinciaCandidatura)
                          ?.comuni.map((comune) => (
                            <option key={comune} value={comune}>
                              {comune}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pulsante Continua */}
            <div className="flex justify-center pt-6">
              <Button
                onClick={handleComplete}
                disabled={!selectedRuolo}
                className="px-8 py-3 text-white font-semibold text-lg shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: selectedRuolo 
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" 
                    : "#9ca3af",
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
