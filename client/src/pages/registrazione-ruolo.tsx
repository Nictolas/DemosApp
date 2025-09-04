import React, { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    { id: "Elettore", nome: "Elettore", descrizione: "Cittadino che può votare" },
    { id: "Politico", nome: "Politico", descrizione: "Rappresentante politico" },
    { id: "Candidato", nome: "Candidato", descrizione: "Candidato alle elezioni" },
    { id: "Candidato Politico", nome: "Candidato Politico", descrizione: "Candidato con esperienza politica" }
  ];

  const gradiElezione = [
    { id: "nazionale", nome: "Nazionale" },
    { id: "regionale", nome: "Regionale" },
    { id: "provinciale", nome: "Provinciale" },
    { id: "comunale", nome: "Comunale" }
  ];

  const gradiCandidatura = [
    { id: "nazionale", nome: "Nazionale" },
    { id: "regionale", nome: "Regionale" },
    { id: "provinciale", nome: "Provinciale" },
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
      const codiceFiscale = localStorage.getItem("registrazione_codice_fiscale");
      const paeseResidenza = localStorage.getItem("registrazione_paese_residenza");
      const regioneResidenza = localStorage.getItem("registrazione_regione_residenza");
      const provinciaResidenza = localStorage.getItem("registrazione_provincia_residenza");
      const comuneResidenza = localStorage.getItem("registrazione_comune_residenza");

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
        codice_fiscale: codiceFiscale,
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
        comune_candidatura: comuneCandidatura
      };

      // Chiama l'API di registrazione (che ha il controllo email duplicata)
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const result = await response.json();

      if (response.ok) {
        // Registrazione completata con successo
        toast({
          title: "Registrazione completata!",
          description: "Controlla la tua email per confermare l'account.",
        });
        
        // Pulisce il localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('registrazione_')) {
            localStorage.removeItem(key);
          }
        });
        
        navigate("/auth");
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

  const showElezioneFields = selectedRuolo === "Politico" || selectedRuolo === "Candidato Politico";
  const showCandidaturaFields = selectedRuolo === "Candidato" || selectedRuolo === "Candidato Politico";

  // Reset dei campi dipendenti quando cambia il paese elezione
  React.useEffect(() => {
    if (paeseElezione !== "Italia") {
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
    if (paeseCandidatura !== "Italia") {
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
                  const colors = [
                    { bg: "#fef9c3", text: "#ca8a04", border: "#fde047" }, // Giallo
                    { bg: "#fbcfe8", text: "#db2777", border: "#f9a8d4" }, // Rosa
                    { bg: "#f0f9ff", text: "#0284c7", border: "#7dd3fc" }, // Blu
                    { bg: "#dcfce7", text: "#16a34a", border: "#86efac" }   // Verde
                  ];
                  const color = colors[index % colors.length];
                  
                  return (
                    <Button
                      key={ruolo.id}
                      variant={selectedRuolo === ruolo.id ? "default" : "outline"}
                      className={`h-auto p-4 text-left justify-start transition-all duration-200 ${
                        selectedRuolo === ruolo.id 
                          ? "shadow-lg transform scale-105" 
                          : "hover:shadow-md hover:scale-102"
                      }`}
                      style={{
                        backgroundColor: selectedRuolo === ruolo.id ? color.bg : "white",
                        color: selectedRuolo === ruolo.id ? color.text : "#374151",
                        borderColor: selectedRuolo === ruolo.id ? color.border : "#d1d5db",
                        borderWidth: "2px"
                      }}
                      onClick={() => handleRuoloSelect(ruolo.id)}
                    >
                      <div>
                        <div className="font-semibold">{ruolo.nome}</div>
                        <div className="text-sm opacity-80 mt-1">{ruolo.descrizione}</div>
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
                    <Select value={paeseElezione} onValueChange={setPaeseElezione}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona paese" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Italia">Italia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Grado Elezione</label>
                    <Select value={gradoElezione} onValueChange={setGradoElezione}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona grado" />
                      </SelectTrigger>
                      <SelectContent>
                        {gradiElezione.map((grado) => (
                          <SelectItem key={grado.id} value={grado.id}>
                            {grado.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {paeseElezione === "Italia" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Regione</label>
                      <Select value={regioneElezione} onValueChange={(value) => {
                        console.log('🌍 Regione elezione selezionata:', value);
                        setRegioneElezione(value);
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona regione" />
                        </SelectTrigger>
                        <SelectContent>
                          {ITALY_DATA.Italia.regioni.map((regione) => (
                            <SelectItem key={regione.id} value={regione.id}>
                              {regione.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Provincia</label>
                      <Select value={provinciaElezione} onValueChange={setProvinciaElezione} disabled={!regioneElezione}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona provincia" />
                        </SelectTrigger>
                        <SelectContent>
                          {regioneElezione && ITALY_DATA.Italia.regioni
                            .find(r => r.id === regioneElezione)
                            ?.province.map((provincia) => (
                              <SelectItem key={provincia.id} value={provincia.id}>
                                {provincia.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Comune</label>
                      <Select value={comuneElezione} onValueChange={setComuneElezione} disabled={!provinciaElezione}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona comune" />
                        </SelectTrigger>
                        <SelectContent>
                          {provinciaElezione && ITALY_DATA.Italia.regioni
                            .find(r => r.id === regioneElezione)
                            ?.province.find(p => p.id === provinciaElezione)
                            ?.comuni.map((comune) => (
                              <SelectItem key={comune} value={comune}>
                                {comune}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
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
                    <Select value={paeseCandidatura} onValueChange={setPaeseCandidatura}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona paese" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Italia">Italia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Grado Candidatura</label>
                    <Select value={gradoCandidatura} onValueChange={setGradoCandidatura}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona grado" />
                      </SelectTrigger>
                      <SelectContent>
                        {gradiCandidatura.map((grado) => (
                          <SelectItem key={grado.id} value={grado.id}>
                            {grado.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {paeseCandidatura === "Italia" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Regione</label>
                      <Select value={regioneCandidatura} onValueChange={(value) => {
                        console.log('🏛️ Regione candidatura selezionata:', value);
                        setRegioneCandidatura(value);
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona regione" />
                        </SelectTrigger>
                        <SelectContent>
                          {ITALY_DATA.Italia.regioni.map((regione) => (
                            <SelectItem key={regione.id} value={regione.id}>
                              {regione.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Provincia</label>
                      <Select value={provinciaCandidatura} onValueChange={setProvinciaCandidatura} disabled={!regioneCandidatura}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona provincia" />
                        </SelectTrigger>
                        <SelectContent>
                          {regioneCandidatura && ITALY_DATA.Italia.regioni
                            .find(r => r.id === regioneCandidatura)
                            ?.province.map((provincia) => (
                              <SelectItem key={provincia.id} value={provincia.id}>
                                {provincia.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Comune</label>
                      <Select value={comuneCandidatura} onValueChange={setComuneCandidatura} disabled={!provinciaCandidatura}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona comune" />
                        </SelectTrigger>
                        <SelectContent>
                          {provinciaCandidatura && ITALY_DATA.Italia.regioni
                            .find(r => r.id === regioneCandidatura)
                            ?.province.find(p => p.id === provinciaCandidatura)
                            ?.comuni.map((comune) => (
                              <SelectItem key={comune} value={comune}>
                                {comune}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
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
