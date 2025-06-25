import { useState, useEffect } from "react";
import { UserInfo } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ITALY_DATA } from "@/data/italyData";
import { apiRequest } from "@/lib/queryClient";

interface EditProfileFormProps {
  userData: UserInfo & { email: string };
  onProfileUpdated: (updatedData: UserInfo) => void;
  onCancel: () => void;
  isAdmin?: boolean;
}

export function EditProfileForm({ userData, onProfileUpdated, onCancel, isAdmin = false }: EditProfileFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<UserInfo & { email: string }>(userData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPaeseResidenza, setSelectedPaeseResidenza] = useState(userData.paese_residenza || "");
  const [selectedRegioneResidenza, setSelectedRegioneResidenza] = useState(userData.regione_residenza || "");
  const [selectedProvinciaResidenza, setSelectedProvinciaResidenza] = useState(userData.provincia_residenza || "");
  
  // Stati per le opzioni di elezione
  const [selectedPaeseElezione, setSelectedPaeseElezione] = useState(userData.paese_elezione || "");
  const [selectedRegioneElezione, setSelectedRegioneElezione] = useState(userData.regione_elezione || "");
  const [selectedProvinciaElezione, setSelectedProvinciaElezione] = useState(userData.provincia_elezione || "");
  
  // Stati per le opzioni di candidatura
  const [selectedPaeseCandidatura, setSelectedPaeseCandidatura] = useState(userData.paese_candidatura || "");
  const [selectedRegioneCandidatura, setSelectedRegioneCandidatura] = useState(userData.regione_candidatura || "");
  const [selectedProvinciaCandidatura, setSelectedProvinciaCandidatura] = useState(userData.provincia_candidatura || "");

  // Funzione generica per aggiornare il formData
  const handleChange = (field: keyof (UserInfo & { email: string }), value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiRequest("PUT", `/api/users/${userData.email}`, formData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore durante l'aggiornamento del profilo");
      }
      
      const data = await response.json();
      
      // Il toast sarà mostrato nel componente chiamante
      
      onProfileUpdated(data.data || formData);
    } catch (error) {
      console.error("Errore durante l'aggiornamento:", error);
      
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Si è verificato un errore durante l'aggiornamento del profilo",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ottieni le opzioni per le regioni in base al paese selezionato
  const getRegioni = (paese: string) => {
    if (paese === "Italia" && ITALY_DATA[paese]) {
      return ITALY_DATA[paese].regioni.map(regione => regione.nome);
    }
    return [];
  };

  // Ottieni le opzioni per le province in base al paese e alla regione selezionata
  const getProvince = (paese: string, regione: string) => {
    if (paese === "Italia" && ITALY_DATA[paese]) {
      const regioneData = ITALY_DATA[paese].regioni.find(r => r.nome === regione);
      if (regioneData) {
        return regioneData.province.map(provincia => provincia.nome);
      }
    }
    return [];
  };

  // Ottieni le opzioni per i comuni in base al paese, alla regione e alla provincia selezionata
  const getComuni = (paese: string, regione: string, provincia: string) => {
    if (paese === "Italia" && ITALY_DATA[paese]) {
      const regioneData = ITALY_DATA[paese].regioni.find(r => r.nome === regione);
      if (regioneData) {
        const provinciaData = regioneData.province.find(p => p.nome === provincia);
        if (provinciaData) {
          return provinciaData.comuni;
        }
      }
    }
    return [];
  };

  // Reset comuni e province quando cambia la regione
  useEffect(() => {
    if (selectedRegioneResidenza && (!userData.regione_residenza || selectedRegioneResidenza !== userData.regione_residenza)) {
      setSelectedProvinciaResidenza("");
      handleChange("provincia_residenza", "");
      handleChange("comune_residenza", "");
    }
  }, [selectedRegioneResidenza, userData.regione_residenza]);

  // Reset comuni quando cambia la provincia
  useEffect(() => {
    if (selectedProvinciaResidenza && (!userData.provincia_residenza || selectedProvinciaResidenza !== userData.provincia_residenza)) {
      handleChange("comune_residenza", "");
    }
  }, [selectedProvinciaResidenza, userData.provincia_residenza]);

  // Effetti simili per elezione
  useEffect(() => {
    if (selectedRegioneElezione && (!userData.regione_elezione || selectedRegioneElezione !== userData.regione_elezione)) {
      setSelectedProvinciaElezione("");
      handleChange("provincia_elezione", "");
      handleChange("comune_elezione", "");
    }
  }, [selectedRegioneElezione, userData.regione_elezione]);

  useEffect(() => {
    if (selectedProvinciaElezione && (!userData.provincia_elezione || selectedProvinciaElezione !== userData.provincia_elezione)) {
      handleChange("comune_elezione", "");
    }
  }, [selectedProvinciaElezione, userData.provincia_elezione]);

  // Effetti simili per candidatura
  useEffect(() => {
    if (selectedRegioneCandidatura && (!userData.regione_candidatura || selectedRegioneCandidatura !== userData.regione_candidatura)) {
      setSelectedProvinciaCandidatura("");
      handleChange("provincia_candidatura", "");
      handleChange("comune_candidatura", "");
    }
  }, [selectedRegioneCandidatura, userData.regione_candidatura]);

  useEffect(() => {
    if (selectedProvinciaCandidatura && (!userData.provincia_candidatura || selectedProvinciaCandidatura !== userData.provincia_candidatura)) {
      handleChange("comune_candidatura", "");
    }
  }, [selectedProvinciaCandidatura, userData.provincia_candidatura]);

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Informazioni personali</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="nome" className="required-field">Nome</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => handleChange("nome", e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cognome" className="required-field">Cognome</Label>
                  <Input
                    id="cognome"
                    value={formData.cognome}
                    onChange={(e) => handleChange("cognome", e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="data_nascita" className="required-field">Data di nascita</Label>
                  <Input
                    id="data_nascita"
                    type="date"
                    value={formData.data_nascita}
                    onChange={(e) => handleChange("data_nascita", e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="genere" className="required-field">Genere</Label>
                  <Select 
                    value={formData.genere} 
                    onValueChange={(value) => handleChange("genere", value)}
                    required
                  >
                    <SelectTrigger id="genere">
                      <SelectValue placeholder="Seleziona genere" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uomo">Uomo</SelectItem>
                      <SelectItem value="donna">Donna</SelectItem>
                      <SelectItem value="altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cittadinanza" className="required-field">Cittadinanza</Label>
                  <Select 
                    value={formData.cittadinanza} 
                    onValueChange={(value) => handleChange("cittadinanza", value)}
                    required
                  >
                    <SelectTrigger id="cittadinanza">
                      <SelectValue placeholder="Seleziona cittadinanza" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Italia">Italia</SelectItem>
                      <SelectItem value="Altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="ruolo" className="required-field">Ruolo</Label>
                    <Select 
                      value={formData.ruolo} 
                      onValueChange={(value) => handleChange("ruolo", value)}
                      required
                    >
                      <SelectTrigger id="ruolo">
                        <SelectValue placeholder="Seleziona ruolo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Elettore">Elettore</SelectItem>
                        <SelectItem value="Candidato">Candidato</SelectItem>
                        <SelectItem value="Politico">Politico</SelectItem>
                        <SelectItem value="Candidato Politico">Candidato Politico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Residenza</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="paese_residenza" className="required-field">Paese</Label>
                  <Select 
                    value={selectedPaeseResidenza} 
                    onValueChange={(value) => {
                      setSelectedPaeseResidenza(value);
                      handleChange("paese_residenza", value);
                      // Resetta regione, provincia e comune quando cambia il paese
                      setSelectedRegioneResidenza("");
                      setSelectedProvinciaResidenza("");
                      handleChange("regione_residenza", "");
                      handleChange("provincia_residenza", "");
                      handleChange("comune_residenza", "");
                    }}
                    required
                  >
                    <SelectTrigger id="paese_residenza">
                      <SelectValue placeholder="Seleziona paese" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Italia">Italia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedPaeseResidenza && (
                  <div className="space-y-2">
                    <Label htmlFor="regione_residenza" className="required-field">Regione</Label>
                    <Select 
                      value={selectedRegioneResidenza} 
                      onValueChange={(value) => {
                        setSelectedRegioneResidenza(value);
                        handleChange("regione_residenza", value);
                      }}
                      required
                    >
                      <SelectTrigger id="regione_residenza">
                        <SelectValue placeholder="Seleziona regione" />
                      </SelectTrigger>
                      <SelectContent>
                        {getRegioni(selectedPaeseResidenza).map((regione) => (
                          <SelectItem key={regione} value={regione}>{regione}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {selectedRegioneResidenza && (
                  <div className="space-y-2">
                    <Label htmlFor="provincia_residenza" className="required-field">Provincia</Label>
                    <Select 
                      value={selectedProvinciaResidenza} 
                      onValueChange={(value) => {
                        setSelectedProvinciaResidenza(value);
                        handleChange("provincia_residenza", value);
                      }}
                      required
                    >
                      <SelectTrigger id="provincia_residenza">
                        <SelectValue placeholder="Seleziona provincia" />
                      </SelectTrigger>
                      <SelectContent>
                        {getProvince(selectedPaeseResidenza, selectedRegioneResidenza).map((provincia) => (
                          <SelectItem key={provincia} value={provincia}>{provincia}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {selectedProvinciaResidenza && (
                  <div className="space-y-2">
                    <Label htmlFor="comune_residenza" className="required-field">Comune</Label>
                    <Select 
                      value={formData.comune_residenza} 
                      onValueChange={(value) => handleChange("comune_residenza", value)}
                      required
                    >
                      <SelectTrigger id="comune_residenza">
                        <SelectValue placeholder="Seleziona comune" />
                      </SelectTrigger>
                      <SelectContent>
                        {getComuni(selectedPaeseResidenza, selectedRegioneResidenza, selectedProvinciaResidenza).map((comune) => (
                          <SelectItem key={comune} value={comune}>{comune}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
            
            {/* Sezioni opzionali per l'elezione e la candidatura a seconda del ruolo */}
            {(formData.ruolo === "Elettore" || formData.ruolo === "Politico" || formData.ruolo === "Candidato" || formData.ruolo === "Candidato Politico") && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Elezione</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="paese_elezione">Paese</Label>
                    <Select 
                      value={selectedPaeseElezione || "nessuno"} 
                      onValueChange={(value) => {
                        const newValue = value === "nessuno" ? "" : value;
                        setSelectedPaeseElezione(newValue);
                        handleChange("paese_elezione", newValue);
                        setSelectedRegioneElezione("");
                        setSelectedProvinciaElezione("");
                        handleChange("regione_elezione", "");
                        handleChange("provincia_elezione", "");
                        handleChange("comune_elezione", "");
                      }}
                    >
                      <SelectTrigger id="paese_elezione">
                        <SelectValue placeholder="Seleziona paese" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Italia">Italia</SelectItem>
                        <SelectItem value="nessuno">Nessuno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedPaeseElezione && (
                    <div className="space-y-2">
                      <Label htmlFor="regione_elezione">Regione</Label>
                      <Select 
                        value={selectedRegioneElezione} 
                        onValueChange={(value) => {
                          setSelectedRegioneElezione(value);
                          handleChange("regione_elezione", value);
                        }}
                      >
                        <SelectTrigger id="regione_elezione">
                          <SelectValue placeholder="Seleziona regione" />
                        </SelectTrigger>
                        <SelectContent>
                          {getRegioni(selectedPaeseElezione).map((regione) => (
                            <SelectItem key={regione} value={regione}>{regione}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {selectedRegioneElezione && (
                    <div className="space-y-2">
                      <Label htmlFor="provincia_elezione">Provincia</Label>
                      <Select 
                        value={selectedProvinciaElezione} 
                        onValueChange={(value) => {
                          setSelectedProvinciaElezione(value);
                          handleChange("provincia_elezione", value);
                        }}
                      >
                        <SelectTrigger id="provincia_elezione">
                          <SelectValue placeholder="Seleziona provincia" />
                        </SelectTrigger>
                        <SelectContent>
                          {getProvince(selectedPaeseElezione, selectedRegioneElezione).map((provincia) => (
                            <SelectItem key={provincia} value={provincia}>{provincia}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {selectedProvinciaElezione && (
                    <div className="space-y-2">
                      <Label htmlFor="comune_elezione">Comune</Label>
                      <Select 
                        value={formData.comune_elezione || "nessuno"} 
                        onValueChange={(value) => handleChange("comune_elezione", value === "nessuno" ? "" : value)}
                      >
                        <SelectTrigger id="comune_elezione">
                          <SelectValue placeholder="Seleziona comune" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nessuno">Nessuno</SelectItem>
                          {getComuni(selectedPaeseElezione, selectedRegioneElezione, selectedProvinciaElezione).map((comune) => (
                            <SelectItem key={comune} value={comune}>{comune}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="grado_elezione">Grado</Label>
                    <Input
                      id="grado_elezione"
                      value={formData.grado_elezione || ""}
                      onChange={(e) => handleChange("grado_elezione", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {(formData.ruolo === "Candidato" || formData.ruolo === "Candidato Politico") && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Candidatura</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="paese_candidatura">Paese</Label>
                    <Select 
                      value={selectedPaeseCandidatura || "nessuno"} 
                      onValueChange={(value) => {
                        const newValue = value === "nessuno" ? "" : value;
                        setSelectedPaeseCandidatura(newValue);
                        handleChange("paese_candidatura", newValue);
                        setSelectedRegioneCandidatura("");
                        setSelectedProvinciaCandidatura("");
                        handleChange("regione_candidatura", "");
                        handleChange("provincia_candidatura", "");
                        handleChange("comune_candidatura", "");
                      }}
                    >
                      <SelectTrigger id="paese_candidatura">
                        <SelectValue placeholder="Seleziona paese" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Italia">Italia</SelectItem>
                        <SelectItem value="nessuno">Nessuno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedPaeseCandidatura && (
                    <div className="space-y-2">
                      <Label htmlFor="regione_candidatura">Regione</Label>
                      <Select 
                        value={selectedRegioneCandidatura} 
                        onValueChange={(value) => {
                          setSelectedRegioneCandidatura(value);
                          handleChange("regione_candidatura", value);
                        }}
                      >
                        <SelectTrigger id="regione_candidatura">
                          <SelectValue placeholder="Seleziona regione" />
                        </SelectTrigger>
                        <SelectContent>
                          {getRegioni(selectedPaeseCandidatura).map((regione) => (
                            <SelectItem key={regione} value={regione}>{regione}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {selectedRegioneCandidatura && (
                    <div className="space-y-2">
                      <Label htmlFor="provincia_candidatura">Provincia</Label>
                      <Select 
                        value={selectedProvinciaCandidatura} 
                        onValueChange={(value) => {
                          setSelectedProvinciaCandidatura(value);
                          handleChange("provincia_candidatura", value);
                        }}
                      >
                        <SelectTrigger id="provincia_candidatura">
                          <SelectValue placeholder="Seleziona provincia" />
                        </SelectTrigger>
                        <SelectContent>
                          {getProvince(selectedPaeseCandidatura, selectedRegioneCandidatura).map((provincia) => (
                            <SelectItem key={provincia} value={provincia}>{provincia}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {selectedProvinciaCandidatura && (
                    <div className="space-y-2">
                      <Label htmlFor="comune_candidatura">Comune</Label>
                      <Select 
                        value={formData.comune_candidatura || "nessuno"} 
                        onValueChange={(value) => handleChange("comune_candidatura", value === "nessuno" ? "" : value)}
                      >
                        <SelectTrigger id="comune_candidatura">
                          <SelectValue placeholder="Seleziona comune" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nessuno">Nessuno</SelectItem>
                          {getComuni(selectedPaeseCandidatura, selectedRegioneCandidatura, selectedProvinciaCandidatura).map((comune) => (
                            <SelectItem key={comune} value={comune}>{comune}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="grado_candidatura">Grado</Label>
                    <Input
                      id="grado_candidatura"
                      value={formData.grado_candidatura || ""}
                      onChange={(e) => handleChange("grado_candidatura", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Annulla
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  "Salva modifiche"
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}