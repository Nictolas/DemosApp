import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { PoliticianProfile } from "../types";

export const useProfileSearch = () => {
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PoliticianProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search for profiles
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci un nome per la ricerca",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/search-politicians?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data.length === 0) {
        setSearchResults([]);
        toast({
          title: "Profilo non trovato",
          description: "Questo profilo non è presente su DEMOS.",
          variant: "destructive"
        });
      } else {
        setSearchResults(data);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Errore di ricerca",
        description: "Si è verificato un errore durante la ricerca",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    handleSearch
  };
};
