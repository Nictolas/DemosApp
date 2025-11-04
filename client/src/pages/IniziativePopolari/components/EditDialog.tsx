import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EditDialogProps } from "../types";
import { iniziativaSchema } from "../constants/schema";

export const EditDialog: React.FC<EditDialogProps> = ({ iniziativa, onClose, onSubmit, isLoading }) => {
  const formatDateForInput = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // Formato YYYY-MM-DD
    } catch {
      return "";
    }
  };

  const defaultValues = React.useMemo(() => {
    if (!iniziativa) {
      return {
        nome: "",
        descrizione: "",
        dataInizio: "",
        dataFine: "",
        sitoWeb: "",
        firme: 0
      };
    }
    return {
      nome: iniziativa.nome || "",
      descrizione: iniziativa.descrizione || "",
      dataInizio: formatDateForInput(iniziativa.dataInizio || iniziativa.data_inizio || ""),
      dataFine: formatDateForInput(iniziativa.dataFine || iniziativa.data_fine || ""),
      sitoWeb: iniziativa.sitoWeb || iniziativa.sito_web || "",
      firme: iniziativa.firme || iniziativa.votiices || 0
    };
  }, [iniziativa]); // Usa l'intero oggetto come nei referendum

  const form = useForm({
    resolver: zodResolver(iniziativaSchema),
    defaultValues
  });

  const [quorum, setQuorum] = React.useState(iniziativa?.quorum || 'pending');

  // Aggiorna il form quando cambia l'iniziativa
  React.useEffect(() => {
    if (iniziativa) {
      const newValues = {
        nome: iniziativa.nome || "",
        descrizione: iniziativa.descrizione || "",
        dataInizio: formatDateForInput(iniziativa.dataInizio || iniziativa.data_inizio || ""),
        dataFine: formatDateForInput(iniziativa.dataFine || iniziativa.data_fine || ""),
        sitoWeb: iniziativa.sitoWeb || iniziativa.sito_web || "",
        firme: iniziativa.firme || iniziativa.votiices || 0
      };
      // Reset sempre quando cambia l'iniziativa per assicurare che i valori siano aggiornati
      form.reset(newValues);
      setQuorum(iniziativa.quorum || 'pending');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iniziativa?.id]);

  const handleSubmit = (data: any) => {
    console.log('🔍 EditDialog - handleSubmit chiamato:', { data, quorum, id: iniziativa?.id });
    onSubmit({ ...data, quorum, id: iniziativa?.id });
  };

  const handleError = (errors: any) => {
    console.error('❌ EditDialog - Errori di validazione:', errors);
    console.error('❌ EditDialog - Valori del form:', form.getValues());
  };

  if (!iniziativa) return null;

  return (
    <Dialog open={!!iniziativa} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader className="bg-white">
          <DialogTitle>Modifica Iniziativa Popolare</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 bg-white">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit, handleError)} className="space-y-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome dell'iniziativa popolare" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="descrizione"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrizione</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descrizione dell'iniziativa popolare" 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dataInizio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Inizio</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dataFine"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Fine</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="sitoWeb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sito Web</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="firme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Firme Raccolte</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        value={field.value || 0}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stato
                </label>
                <Select value={quorum} onValueChange={setQuorum}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona stato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proposta">Proposta</SelectItem>
                    <SelectItem value="pending">In corso</SelectItem>
                    <SelectItem value="ok">Raggiunto</SelectItem>
                    <SelectItem value="no">Non raggiunto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Annulla
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Salvando..." : "Salva"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
