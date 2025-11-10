import { useState, useEffect } from "react";
import { ITALY_DATA } from "@/data/italyData";

interface GeographicData {
  selectedPaese: string;
  selectedRegione: string;
  selectedProvincia: string;
  selectedComune: string;
  regioni: string[];
  province: string[];
  comuni: string[];
}

export function useGeographicData(
  initialData: {
    paese_residenza?: string;
    regione_residenza?: string;
    provincia_residenza?: string;
    comune_residenza?: string;
    paese_elezione?: string;
    regione_elezione?: string;
    provincia_elezione?: string;
    comune_elezione?: string;
    paese_candidatura?: string;
    regione_candidatura?: string;
    provincia_candidatura?: string;
    comune_candidatura?: string;
    // Supporto per i nomi legacy
    paese?: string;
    regione?: string;
    provincia?: string;
    comune?: string;
  }
) {
  // Mapping per convertire i codici paese
  const mapPaeseCode = (code: string) => {
    const mapping: Record<string, string> = {
      'it': 'Italia',
      'IT': 'Italia',
      'italy': 'Italia',
      'Italy': 'Italia'
    };
    return mapping[code] || code;
  };

  // Estrai i dati: prima prova i campi specifici (elezione/candidatura/residenza), poi i legacy
  const rawPaese = initialData.paese_elezione || 
                   initialData.paese_candidatura || 
                   initialData.paese_residenza || 
                   initialData.paese || 
                   "";
  const mappedPaese = mapPaeseCode(rawPaese);

  const rawRegione = initialData.regione_elezione || 
                     initialData.regione_candidatura || 
                     initialData.regione_residenza || 
                     initialData.regione || 
                     "";
  
  const rawProvincia = initialData.provincia_elezione || 
                       initialData.provincia_candidatura || 
                       initialData.provincia_residenza || 
                       initialData.provincia || 
                       "";
  
  const rawComune = initialData.comune_elezione || 
                    initialData.comune_candidatura || 
                    initialData.comune_residenza || 
                    initialData.comune || 
                    "";

  const [data, setData] = useState<GeographicData>({
    selectedPaese: mappedPaese,
    selectedRegione: rawRegione,
    selectedProvincia: rawProvincia,
    selectedComune: rawComune,
    regioni: [],
    province: [],
    comuni: [],
  });

  // Ottieni le opzioni per le regioni in base al paese selezionato
  const getRegioni = (paese: string) => {
    if (paese === "Italia" && ITALY_DATA[paese]) {
      return ITALY_DATA[paese].regioni.map(regione => regione.nome);
    }
    return [];
  };

  // Ottieni le opzioni per le province in base alla regione selezionata
  const getProvince = (paese: string, regione: string) => {
    if (paese === "Italia" && ITALY_DATA[paese]) {
      const regioneData = ITALY_DATA[paese].regioni.find(r => r.nome === regione);
      return regioneData ? regioneData.province.map(provincia => provincia.nome) : [];
    }
    return [];
  };

  // Ottieni le opzioni per i comuni in base alla provincia selezionata
  const getComuni = (paese: string, regione: string, provincia: string) => {
    if (paese === "Italia" && ITALY_DATA[paese]) {
      const regioneData = ITALY_DATA[paese].regioni.find(r => r.nome === regione);
      if (regioneData) {
        const provinciaData = regioneData.province.find(p => p.nome === provincia);
        return provinciaData ? provinciaData.comuni : [];
      }
    }
    return [];
  };

  // Aggiorna il paese e resetta i campi dipendenti
  const updatePaese = (paese: string) => {
    const regioni = getRegioni(paese);
    setData(prev => ({
      ...prev,
      selectedPaese: paese,
      selectedRegione: "",
      selectedProvincia: "",
      selectedComune: "",
      regioni,
      province: [],
      comuni: [],
    }));
  };

  // Aggiorna la regione e resetta i campi dipendenti
  const updateRegione = (regione: string) => {
    const province = getProvince(data.selectedPaese, regione);
    setData(prev => ({
      ...prev,
      selectedRegione: regione,
      selectedProvincia: "",
      selectedComune: "",
      province,
      comuni: [],
    }));
  };

  // Aggiorna la provincia e resetta i campi dipendenti
  const updateProvincia = (provincia: string) => {
    const comuni = getComuni(data.selectedPaese, data.selectedRegione, provincia);
    setData(prev => ({
      ...prev,
      selectedProvincia: provincia,
      selectedComune: "",
      comuni,
    }));
  };

  // Aggiorna il comune
  const updateComune = (comune: string) => {
    setData(prev => ({
      ...prev,
      selectedComune: comune,
    }));
  };

  // Aggiorna i dati quando initialData cambia
  useEffect(() => {
    const rawPaese = initialData.paese_elezione || 
                     initialData.paese_candidatura || 
                     initialData.paese_residenza || 
                     initialData.paese || 
                     "";
    const mappedPaese = mapPaeseCode(rawPaese);

    const rawRegione = initialData.regione_elezione || 
                       initialData.regione_candidatura || 
                       initialData.regione_residenza || 
                       initialData.regione || 
                       "";
    
    const rawProvincia = initialData.provincia_elezione || 
                         initialData.provincia_candidatura || 
                         initialData.provincia_residenza || 
                         initialData.provincia || 
                         "";
    
    const rawComune = initialData.comune_elezione || 
                      initialData.comune_candidatura || 
                      initialData.comune_residenza || 
                      initialData.comune || 
                      "";

    // Calcola le liste geografiche
    const regioni = getRegioni(mappedPaese);
    const province = rawRegione ? getProvince(mappedPaese, rawRegione) : [];
    const comuni = (rawRegione && rawProvincia) ? getComuni(mappedPaese, rawRegione, rawProvincia) : [];
    
    // Aggiorna sempre i dati quando initialData cambia
    setData(prev => {
      // Aggiorna solo se i valori sono effettivamente cambiati
      if (prev.selectedPaese !== mappedPaese || 
          prev.selectedRegione !== rawRegione || 
          prev.selectedProvincia !== rawProvincia || 
          prev.selectedComune !== rawComune) {
        return {
          selectedPaese: mappedPaese,
          selectedRegione: rawRegione,
          selectedProvincia: rawProvincia,
          selectedComune: rawComune,
          regioni,
          province,
          comuni,
        };
      }
      // Se i valori non sono cambiati ma le liste potrebbero essere vuote, aggiornale
      if (mappedPaese && prev.regioni.length === 0) {
        return { ...prev, regioni };
      }
      if (rawRegione && prev.province.length === 0) {
        return { ...prev, province };
      }
      if (rawProvincia && prev.comuni.length === 0) {
        return { ...prev, comuni };
      }
      return prev;
    });
  }, [
    initialData.paese_elezione,
    initialData.regione_elezione,
    initialData.provincia_elezione,
    initialData.comune_elezione,
    initialData.paese_candidatura,
    initialData.regione_candidatura,
    initialData.provincia_candidatura,
    initialData.comune_candidatura,
    initialData.paese_residenza,
    initialData.regione_residenza,
    initialData.provincia_residenza,
    initialData.comune_residenza,
    initialData.paese,
    initialData.regione,
    initialData.provincia,
    initialData.comune,
  ]);

  // Aggiorna le province quando cambia la regione
  useEffect(() => {
    if (data.selectedPaese && data.selectedRegione) {
      const province = getProvince(data.selectedPaese, data.selectedRegione);
      setData(prev => ({ ...prev, province }));
    }
  }, [data.selectedPaese, data.selectedRegione]);

  // Aggiorna i comuni quando cambia la provincia
  useEffect(() => {
    if (data.selectedPaese && data.selectedRegione && data.selectedProvincia) {
      const comuni = getComuni(data.selectedPaese, data.selectedRegione, data.selectedProvincia);
      setData(prev => ({ ...prev, comuni }));
    }
  }, [data.selectedPaese, data.selectedRegione, data.selectedProvincia]);

  return {
    ...data,
    updatePaese,
    updateRegione,
    updateProvincia,
    updateComune,
  };
}
