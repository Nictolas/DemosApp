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
    // Supporto per i nomi legacy
    paese?: string;
    regione?: string;
    provincia?: string;
    comune?: string;
  }
) {
  const [data, setData] = useState<GeographicData>({
    selectedPaese: initialData.paese_residenza || initialData.paese || "",
    selectedRegione: initialData.regione_residenza || initialData.regione || "",
    selectedProvincia: initialData.provincia_residenza || initialData.provincia || "",
    selectedComune: initialData.comune_residenza || initialData.comune || "",
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

  // Inizializza i dati geografici
  useEffect(() => {
    if (data.selectedPaese) {
      const regioni = getRegioni(data.selectedPaese);
      setData(prev => ({ ...prev, regioni }));
    }
  }, []);

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
