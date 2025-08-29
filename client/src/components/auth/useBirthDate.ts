import { useState, useEffect } from "react";
import { UseFormSetValue } from "react-hook-form";
import { RegisterFormValues } from "./authSchemas";

export function useBirthDate(setValue: UseFormSetValue<RegisterFormValues>) {
  // Stati per la data di nascita
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

  // Array per giorni, mesi e anni
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  const months = [
    { value: "01", label: "Gennaio" },
    { value: "02", label: "Febbraio" },
    { value: "03", label: "Marzo" },
    { value: "04", label: "Aprile" },
    { value: "05", label: "Maggio" },
    { value: "06", label: "Giugno" },
    { value: "07", label: "Luglio" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Settembre" },
    { value: "10", label: "Ottobre" },
    { value: "11", label: "Novembre" },
    { value: "12", label: "Dicembre" },
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => (currentYear - i).toString());

  // Aggiorna il campo data_nascita quando cambiano giorno, mese o anno
  useEffect(() => {
    if (birthDay && birthMonth && birthYear) {
      setValue("data_nascita", `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`);
    } else {
      setValue("data_nascita", "");
    }
  }, [birthDay, birthMonth, birthYear, setValue]);

  return {
    birthDay,
    setBirthDay,
    birthMonth,
    setBirthMonth,
    birthYear,
    setBirthYear,
    days,
    months,
    years,
  };
}
