import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus } from "lucide-react";
import { useElezioneForm } from "../hooks/useElezioneForm";
import { Elezione } from "../types";

interface ElezioneFormProps {
  onSuccess: () => void;
}

export const ElezioneForm: React.FC<ElezioneFormProps> = ({ onSuccess }) => {
  const { form, editingElezione, submitting, handleSubmit, handleEdit, resetForm } = useElezioneForm(onSuccess);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const onSubmit = (data: any) => {
    handleSubmit(data);
    setIsDialogOpen(false);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
        >
          <Plus className="h-6 w-6 mr-3" />
          Aggiungi Nuova Elezione
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingElezione ? "Modifica Elezione" : "Aggiungi Nuova Elezione"}</DialogTitle>
          <DialogDescription>{editingElezione ? "Modifica i dettagli dell'elezione." : "Compila il modulo per creare una nuova elezione."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="tipo" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo di Elezione</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Seleziona un tipo" /></SelectTrigger></FormControl>
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
            )} />
            <FormField control={form.control} name="zona" render={({ field }) => (
              <FormItem>
                <FormLabel>Zona</FormLabel>
                <FormControl><Input placeholder="Zona geografica" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="datainizio" render={({ field }) => (
                <FormItem>
                  <FormLabel>Anno Inizio</FormLabel>
                  <FormControl><Input type="number" min="2020" max="2050" placeholder="2024" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="datafine" render={({ field }) => (
                <FormItem>
                  <FormLabel>Anno Fine</FormLabel>
                  <FormControl><Input type="number" min="2020" max="2050" placeholder="2024" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="circa" render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Data approssimativa</FormLabel>
                </div>
              </FormItem>
            )} />
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Salvataggio..." : editingElezione ? "Aggiorna" : "Crea"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
