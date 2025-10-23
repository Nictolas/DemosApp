import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Edit, Trash2, Check, X, FileText } from "lucide-react";
import { Opinione, GRADI_OPINIONE } from "../types";
import { useOpinioniMutations } from "../hooks";
import { ApprofondimentoDialog } from "./ApprofondimentoDialog";

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
  const [approfondimentoDialogOpen, setApprofondimentoDialogOpen] = useState(false);
  const [selectedOpinione, setSelectedOpinione] = useState<Opinione | null>(null);
  const [filtroGrado, setFiltroGrado] = useState<string | null>(null);
  
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

  const handleApprofondimento = (opinione: Opinione) => {
    setSelectedOpinione(opinione);
    setApprofondimentoDialogOpen(true);
  };

  const handleFiltroGrado = (grado: string) => {
    setFiltroGrado(filtroGrado === grado ? null : grado);
  };

  const handleRimuoviFiltro = () => {
    setFiltroGrado(null);
  };

  const handleToggleGrado = (opinioneId: string, grado: string) => {
    const opinione = opinioni.find(op => op.id === opinioneId);
    if (!opinione) return;

    const currentGradi = opinione.gradi_opinione || [];
    const newGradi = currentGradi.includes(grado)
      ? currentGradi.filter(g => g !== grado)
      : [...currentGradi, grado];

    editMutation.mutate({
      id: opinioneId,
      text: opinione.text,
      gradi_opinione: newGradi
    });
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

  // Filtra le opinioni in base al grado selezionato
  const opinioniFiltrate = filtroGrado 
    ? opinioni.filter(op => op.gradi_opinione?.includes(filtroGrado))
    : opinioni;

  // Ordina le opinioni alfabeticamente per testo
  const opinioniOrdinate = [...opinioniFiltrate].sort((a, b) => 
    a.text.localeCompare(b.text, 'it', { sensitivity: 'base' })
  );

  return (
    <div className="space-y-4">
      {/* Header con filtri */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Opinioni Ufficiali</h3>
          {filtroGrado && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRimuoviFiltro}
              className="text-xs"
            >
              Rimuovi filtro
            </Button>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {GRADI_OPINIONE.map(grado => (
            <button
              key={grado}
              onClick={() => handleFiltroGrado(grado)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filtroGrado === grado
                  ? "bg-blue-500 text-white shadow-md"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
              }`}
            >
              {grado}
            </button>
          ))}
        </div>
        
        {filtroGrado && (
          <div className="mt-2 text-sm text-gray-600">
            Mostrando {opinioniOrdinate.length} opinioni per grado "{filtroGrado}"
          </div>
        )}
      </div>

      {/* Lista opinioni */}
      <div className="space-y-2">
        {opinioniOrdinate.map((op) => (
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
                  <button
                    key={grado}
                    onClick={() => handleToggleGrado(op.id, grado)}
                    disabled={editMutation.isPending}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      op.gradi_opinione?.includes(grado) 
                        ? "bg-blue-500 text-white hover:bg-blue-600" 
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    } ${editMutation.isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    title={op.gradi_opinione?.includes(grado) ? `Rimuovi grado ${grado}` : `Aggiungi grado ${grado}`}
                  >
                    {grado}
                  </button>
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
                  title="Modifica opinione"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleApprofondimento(op)}
                  title="Crea/modifica Approfondimento"
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  disabled={deleteMutation.isPending} 
                  onClick={() => handleDelete(op.id)}
                  title="Elimina opinione"
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
      
      {/* Dialog per Approfondimento */}
      {selectedOpinione && (
        <ApprofondimentoDialog
          opinione={selectedOpinione}
          open={approfondimentoDialogOpen}
          onOpenChange={setApprofondimentoDialogOpen}
        />
      )}
    </div>
  );
};
