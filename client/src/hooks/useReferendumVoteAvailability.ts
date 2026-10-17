import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export function useReferendumVoteAvailability() {
  const [available, setAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await apiRequest("GET", "/api/referendum/vote-real/availability");
        if (!cancelled) {
          setAvailable(response?.data?.available === true);
        }
      } catch {
        if (!cancelled) setAvailable(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { available, isLoading };
}
