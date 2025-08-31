import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Edit, Trash2, Check, X } from "lucide-react";
import { Opinione, GRADI_OPINIONE } from "../types";
import { useOpinioniMutations } from "../hooks";

interface ListaOpinioniProps {
  opinioni: Opinione[];
  isLoading: boolean;
  isError: boolean;
}

export const ListaOpinioni: React.FC<ListaOpinioniProps> = ({ 
  opinioni, 
  isLoading, 
  isError 
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editGrado, setEditGrado] = useState("Nazionale");
  
  const { deleteMutation, editMutation } = useOpinioniMutations();

  const handleDelete = (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questa opinione? Verrà rimossa da tutto il sistema.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleEditSave = () => {
    if (!editingId || !editText.trim()) return;
    
    // Trova l'opinione corrente per mantenere i gradi esistenti
    const currentOpinione = opinioni.find(op => op.id === editingId);
    const currentGradi = currentOpinione?.gradi_opinione || [];
    
    // Se il grado selezionato non è già presente, aggiungilo
    let newGradi = currentGradi;
    if (!currentGradi.includes(editGrado)) {
      newGradi = [...currentGradi, editGrado];
    }
    
    editMutation.mutate({ 
      id: editingId, 
      text: editText.trim(), 
      gradi_opinione: newGradi 
    });
    
    // Reset editing state
    setEditingId(null);
    setEditText("");
    setEditGrado("Nazionale");
  };

  const handleEditStart = (op: Opinione) => {
    setEditingId(op.id);
    setEditText(op.text);
    setEditGrado(op.gradi_opinione?.[0] || "Nazionale");
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditText("");
    setEditGrado("Nazionale");
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center text-red-500 py-8">
        Errore nel caricamento delle opinioni.
      </div>
    );
  }

  if (!Array.isArray(opinioni)) {
    return (
      <div className="text-center text-red-500 py-8">
        Errore nel caricamento delle opinioni
      </div>
    );
  }

  if (opinioni.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        Nessuna opinione disponibile
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {opinioni.map((op) => (
        <div key={op.id} className="flex items-center justify-between border rounded-lg px-4 py-2 bg-white shadow-sm">
          {editingId === op.id ? (
            <div className="flex flex-col md:flex-row gap-2 flex-1">
              <Input 
                value={editText} 
                onChange={e => setEditText(e.target.value)} 
                className="flex-1" 
              />
              <Select onValueChange={setEditGrado} defaultValue={editGrado}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Grado Opinione" />
                </SelectTrigger>
                <SelectContent>
                  {GRADI_OPINIONE.map(grado => (
                    <SelectItem key={grado} value={grado}>{grado}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="font-medium">
                {op.text} <span className="text-xs text-muted-foreground">({op.id})</span>
              </span>
              <div className="flex flex-wrap gap-2 mt-1">
                {GRADI_OPINIONE.map(grado => (
                  <label key={grado} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={op.gradi_opinione?.includes(grado) || false}
                      onChange={(e) => {
                        const currentGradi = op.gradi_opinione || [];
                        let newGradi;
                        if (e.target.checked) {
                          newGradi = [...currentGradi, grado];
                        } else {
                          newGradi = currentGradi.filter(g => g !== grado);
                        }
                        editMutation.mutate({ 
                          id: op.id, 
                          text: op.text, 
                          gradi_opinione: newGradi 
                        });
                      }}
                      className="w-3 h-3"
                    />
                    <span className={op.gradi_opinione?.includes(grado) ? "font-medium" : "text-muted-foreground"}>
                      {grado}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            {editingId === op.id ? (
              <>
                <Button 
                  size="sm" 
                  onClick={handleEditSave} 
                  disabled={editMutation.isPending || !editText.trim()}
                >
                  {editMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin"/>
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleEditCancel}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleEditStart(op)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  disabled={deleteMutation.isPending} 
                  onClick={() => handleDelete(op.id)}
                >
                  {deleteMutation.isPending && deleteMutation.variables === op.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
