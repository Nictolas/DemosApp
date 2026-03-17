import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2 } from "lucide-react";
import { MinisteroFormData } from "../types";
import { FORM_LABELS } from "../constants";

interface MinisteroFormProps {
  form: MinisteroFormData;
  setForm: (form: MinisteroFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export function MinisteroForm({ form, setForm, onSubmit, isLoading }: MinisteroFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col md:flex-row gap-2 mb-6 items-end">
      <Input 
        placeholder={FORM_LABELS.NOME} 
        value={form.nome} 
        onChange={(e) => setForm({...form, nome: e.target.value})} 
        required 
        className="md:w-1/3"
      />
      <Input 
        placeholder={FORM_LABELS.CATEGORIA} 
        value={form.categoria} 
        onChange={(e) => setForm({...form, categoria: e.target.value})} 
        required 
        className="md:w-1/4"
      />
      <Input 
        placeholder={FORM_LABELS.DESCRIZIONE} 
        value={form.descrizione} 
        onChange={(e) => setForm({...form, descrizione: e.target.value})} 
        className="md:w-1/3"
      />
      <Button 
        type="submit" 
        disabled={isLoading} 
        className="bg-yellow-600 hover:bg-yellow-700"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Plus className="h-4 w-4 mr-1" /> 
            {FORM_LABELS.AGGIUNGI}
          </>
        )}
      </Button>
    </form>
  );
}
