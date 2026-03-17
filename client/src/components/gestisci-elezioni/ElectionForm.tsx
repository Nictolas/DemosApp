import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ElectionFormProps, elezioneSchema, ElezioneForm } from "./types";

export function ElectionForm({ editingElezione, onSubmit, onCancel, submitting }: ElectionFormProps) {
  const form = useForm<ElezioneForm>({
    resolver: zodResolver(elezioneSchema),
    defaultValues: { 
      tipo: "stato", 
      zona: "", 
      datainizio: "", 
      datafine: "", 
      circa: true
    },
  });

  // Reset form quando cambia l'elezione in editing
  React.useEffect(() => {
    if (editingElezione) {
      form.reset({
        tipo: editingElezione.tipo as any,
        zona: editingElezione.zona,
        datainizio: editingElezione.datainizio,
        datafine: editingElezione.datafine,
        circa: editingElezione.circa
      });
    } else {
      form.reset({
        tipo: "stato",
        zona: "",
        datainizio: "",
        datafine: "",
        circa: true
      });
    }
  }, [editingElezione, form]);

  const handleSubmit = async (data: ElezioneForm) => {
    await onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={!!editingElezione || !editingElezione} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingElezione ? "Modifica Elezione" : "Aggiungi Nuova Elezione"}</DialogTitle>
          <DialogDescription>
            {editingElezione ? "Modifica i dettagli dell'elezione." : "Compila il modulo per creare una nuova elezione."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
            <FormField 
              control={form.control} 
              name="tipo" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo di Elezione</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona un tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sovranazione">Sovranazione</SelectItem>
                      <SelectItem value="stato">Stato</SelectItem>
                      <SelectItem value="regione">Regione</SelectItem>
                      <SelectItem value="provincia">Provincia</SelectItem>
                      <SelectItem value="comune">Comune</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} 
            />
            
            <FormField 
              control={form.control} 
              name="zona" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zona</FormLabel>
                  <FormControl>
                    <Input placeholder="Zona geografica" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField 
                control={form.control} 
                name="datainizio" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anno Inizio</FormLabel>
                    <FormControl>
                      <Input type="number" min="2020" max="2050" placeholder="2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />
              
              <FormField 
                control={form.control} 
                name="datafine" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anno Fine</FormLabel>
                    <FormControl>
                      <Input type="number" min="2020" max="2050" placeholder="2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />
            </div>
            
            <FormField 
              control={form.control} 
              name="circa" 
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Circa (data approssimativa)</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Se spuntato, le date sono approssimative.
                    </p>
                  </div>
                </FormItem>
              )} 
            />
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Annulla
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : "Salva Elezione"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
