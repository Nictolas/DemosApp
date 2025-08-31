import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { GRADI_OPINIONE } from "../types";
import { useOpinioniMutations } from "../hooks";

export const FormAggiungiOpinione: React.FC = () => {
  const [newId, setNewId] = useState("");
  const [newText, setNewText] = useState("");
  const [newGrado, setNewGrado] = useState("Nazionale");
  
  const { addMutation } = useOpinioniMutations();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim() || !newText.trim()) return;
    
    addMutation.mutate({ 
      id: newId.trim(), 
      text: newText.trim(), 
      gradi_opinione: [newGrado] 
    });
    
    // Reset form
    setNewId("");
    setNewText("");
    setNewGrado("Nazionale");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-6">
      <div className="flex flex-col md:flex-row gap-2">
        <Input 
          placeholder="ID (es. caccia)" 
          value={newId} 
          onChange={e => setNewId(e.target.value)} 
          className="max-w-xs" 
        />
        <Input 
          placeholder="Testo (es. Caccia)" 
          value={newText} 
          onChange={e => setNewText(e.target.value)} 
          className="flex-1" 
        />
        <Select onValueChange={setNewGrado} defaultValue={newGrado}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Grado Opinione" />
          </SelectTrigger>
          <SelectContent>
            {GRADI_OPINIONE.map(grado => (
              <SelectItem key={grado} value={grado}>{grado}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button 
          type="submit" 
          disabled={addMutation.isPending || !newId.trim() || !newText.trim()}
        >
          {addMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Aggiungi
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
