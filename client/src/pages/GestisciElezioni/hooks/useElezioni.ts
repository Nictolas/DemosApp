import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Elezione } from "../types";

export const useElezioni = () => {
  const [elezioni, setElezioni] = useState<Elezione[]>([]);
  const [loading, setLoading] = useState(true);

  const loadElezioni = async () => {
    try {
      setLoading(true);
      // 1. Carica tutte le elezioni tramite API
      const response = await apiRequest("GET", "/api/elezioni");
      if (!response.ok) throw new Error("Caricamento fallito.");
      
      const data = await response.json();
      setElezioni(data.elezioni || []);
    } catch (error) {
      console.error('❌ DEBUG: Errore nel caricamento:', error);
      setElezioni([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadElezioni();
  }, []);

  return {
    elezioni,
    loading,
    loadElezioni,
  };
};
