import { useState, useEffect } from "react";
import { UseFormWatch } from "react-hook-form";
import { ITALY_DATA } from "@/data/italyData";
import { RegisterFormValues } from "./authSchemas";

export function useGeographicSelections(watch: UseFormWatch<RegisterFormValues>) {
  // Selezioni a cascata per residenza, elezione, candidatura
  const [regioniResidenza, setRegioniResidenza] = useState<string[]>([]);
  const [provinceResidenza, setProvinceResidenza] = useState<string[]>([]);
  const [comuniResidenza, setComuniResidenza] = useState<string[]>([]);
  const [regioniElezione, setRegioniElezione] = useState<string[]>([]);
  const [provinceElezione, setProvinceElezione] = useState<string[]>([]);
  const [comuniElezione, setComuniElezione] = useState<string[]>([]);
  const [regioniCandidatura, setRegioniCandidatura] = useState<string[]>([]);
  const [provinceCandidatura, setProvinceCandidatura] = useState<string[]>([]);
  const [comuniCandidatura, setComuniCandidatura] = useState<string[]>([]);

  // Effetti per le selezioni a cascata (residenza)
  useEffect(() => {
    const paese = watch("paese_residenza");
    if (paese === "Italia") {
      setRegioniResidenza(ITALY_DATA.Italia.regioni.map(r => r.nome));
    } else {
      setRegioniResidenza([]);
    }
    setProvinceResidenza([]);
    setComuniResidenza([]);
  }, [watch("paese_residenza")]);

  useEffect(() => {
    const paese = watch("paese_residenza");
    const regione = watch("regione_residenza");
    if (paese === "Italia" && regione) {
      const reg = ITALY_DATA.Italia.regioni.find(r => r.nome === regione);
      if (reg) setProvinceResidenza(reg.province.map(p => p.nome));
    } else {
      setProvinceResidenza([]);
    }
    setComuniResidenza([]);
  }, [watch("regione_residenza")]);

  useEffect(() => {
    const paese = watch("paese_residenza");
    const regione = watch("regione_residenza");
    const provincia = watch("provincia_residenza");
    if (paese === "Italia" && regione && provincia) {
      const reg = ITALY_DATA.Italia.regioni.find(r => r.nome === regione);
      if (reg) {
        const prov = reg.province.find(p => p.nome === provincia);
        if (prov) setComuniResidenza(prov.comuni);
      }
    } else {
      setComuniResidenza([]);
    }
  }, [watch("provincia_residenza")]);

  // Effetti per elezione
  useEffect(() => {
    const paese = watch("paese_elezione");
    if (paese === "Italia") {
      setRegioniElezione(ITALY_DATA.Italia.regioni.map(r => r.nome));
    } else {
      setRegioniElezione([]);
    }
    setProvinceElezione([]);
    setComuniElezione([]);
  }, [watch("paese_elezione")]);

  useEffect(() => {
    const paese = watch("paese_elezione");
    const regione = watch("regione_elezione");
    if (paese === "Italia" && regione) {
      const reg = ITALY_DATA.Italia.regioni.find(r => r.nome === regione);
      if (reg) setProvinceElezione(reg.province.map(p => p.nome));
    } else {
      setProvinceElezione([]);
    }
    setComuniElezione([]);
  }, [watch("regione_elezione")]);

  useEffect(() => {
    const paese = watch("paese_elezione");
    const regione = watch("regione_elezione");
    const provincia = watch("provincia_elezione");
    if (paese === "Italia" && regione && provincia) {
      const reg = ITALY_DATA.Italia.regioni.find(r => r.nome === regione);
      if (reg) {
        const prov = reg.province.find(p => p.nome === provincia);
        if (prov) setComuniElezione(prov.comuni);
      }
    } else {
      setComuniElezione([]);
    }
  }, [watch("provincia_elezione")]);

  // Effetti per candidatura
  useEffect(() => {
    const paese = watch("paese_candidatura");
    if (paese === "Italia") {
      setRegioniCandidatura(ITALY_DATA.Italia.regioni.map(r => r.nome));
    } else {
      setRegioniCandidatura([]);
    }
    setProvinceCandidatura([]);
    setComuniCandidatura([]);
  }, [watch("paese_candidatura")]);

  useEffect(() => {
    const paese = watch("paese_candidatura");
    const regione = watch("regione_candidatura");
    if (paese === "Italia" && regione) {
      const reg = ITALY_DATA.Italia.regioni.find(r => r.nome === regione);
      if (reg) setProvinceCandidatura(reg.province.map(p => p.nome));
    } else {
      setProvinceCandidatura([]);
    }
    setComuniCandidatura([]);
  }, [watch("regione_candidatura")]);

  useEffect(() => {
    const paese = watch("paese_candidatura");
    const regione = watch("regione_candidatura");
    const provincia = watch("provincia_candidatura");
    if (paese === "Italia" && regione && provincia) {
      const reg = ITALY_DATA.Italia.regioni.find(r => r.nome === regione);
      if (reg) {
        const prov = reg.province.find(p => p.nome === provincia);
        if (prov) setComuniCandidatura(prov.comuni);
      }
    } else {
      setComuniCandidatura([]);
    }
  }, [watch("provincia_candidatura")]);

  return {
    regioniResidenza,
    provinceResidenza,
    comuniResidenza,
    regioniElezione,
    provinceElezione,
    comuniElezione,
    regioniCandidatura,
    provinceCandidatura,
    comuniCandidatura,
  };
}
