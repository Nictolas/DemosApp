import React, { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { ProponiFormProps } from "../types";

export const ProponiForm: React.FC<ProponiFormProps> = ({
  testoInput,
  submitting,
  onSubmit,
  onInputChange,
  opinioniEsistenti = [],
  haGiaProposto = false
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const formSubmittedRef = useRef(false);

  // Filtra le opinioni esistenti in base al testo inserito
  const suggestions = useMemo(() => {
    if (!testoInput.trim() || testoInput.trim().length < 2) {
      return [];
    }

    const searchTerm = testoInput.trim().toLowerCase();
    return opinioniEsistenti
      .filter(op => op.toLowerCase().includes(searchTerm))
      .slice(0, 5); // Mostra max 5 suggerimenti
  }, [testoInput, opinioniEsistenti]);

  // Chiudi i suggerimenti quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleInputChange = (value: string) => {
    onInputChange(value);
    setShowSuggestions(true);
    setSelectedIndex(-1);
  };

  const handleSelectSuggestion = (suggestion: string) => {
    onInputChange(suggestion);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
      setShowSuggestions(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div className="space-y-4">
      {haGiaProposto ? (
        <p className="text-sm text-muted-foreground">
          Hai già proposto un'opinione. Puoi proporne solo una. Puoi comunque votare le opinioni proposte da altri.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (formSubmittedRef.current || submitting) return;
            formSubmittedRef.current = true;
            const result = onSubmit(e);
            if (result && typeof result === 'object' && 'then' in result) {
              Promise.resolve(result).finally(() => {
                setTimeout(() => { formSubmittedRef.current = false; }, 1000);
              });
            } else {
              setTimeout(() => { formSubmittedRef.current = false; }, 1000);
            }
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="flex-1 min-w-[200px] relative">
            <Input
              ref={inputRef}
              placeholder="Testo della nuova opinione..."
              value={testoInput}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              disabled={submitting}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
              >
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`px-4 py-2 cursor-pointer hover:bg-fuchsia-50 ${
                      index === selectedIndex ? "bg-fuchsia-100" : ""
                    } ${index === 0 ? "rounded-t-md" : ""} ${
                      index === suggestions.length - 1 ? "rounded-b-md" : ""
                    }`}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="text-sm">{suggestion}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button
            type="submit"
            disabled={submitting || !testoInput.trim()}
            className="bg-fuchsia-600 hover:bg-fuchsia-700"
          >
            <Plus className="h-4 w-4 mr-1" /> Proponi
          </Button>
        </form>
      )}
    </div>
  );
};
