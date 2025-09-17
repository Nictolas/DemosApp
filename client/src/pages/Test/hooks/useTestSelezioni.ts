import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import apiRequest from "@/lib/api-request";

export const useTestSelezioni = () => {
  const [selezioni, setSelezioni] = useState<Record<string, any>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['testSelezioni'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/test/selezioni");
      if (!response.ok) {
        throw new Error("Impossibile caricare le selezioni di test");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minuti
  });

  useEffect(() => {
    if (data?.success) {
      const { candidati } = data.data;
      setSelezioni(candidati || {});
    }
  }, [data]);

  return {
    selezioni,
    isLoading,
    error
  };
};
