import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { carceratoSchema, DEFAULT_FORM_VALUES, CarceratoFormData } from "../constants/schema";

interface CarceratoFormProps {
  onSubmit: (data: CarceratoFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export const CarceratoForm: React.FC<CarceratoFormProps> = ({ onSubmit, onCancel, isLoading }) => {
  const form = useForm({
    resolver: zodResolver(carceratoSchema),
    defaultValues: DEFAULT_FORM_VALUES
  });

  const handleSubmit = (data: CarceratoFormData) => {
    onSubmit(data);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Proponi Carcerato</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4 bg-yellow-50 border-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>ATTENZIONE:</strong> Per proporre un carcerato per la grazia, assicurati di avere 
            informazioni verificate e documentate sul caso.
          </AlertDescription>
        </Alert>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome del carcerato" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="cognome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cognome</FormLabel>
                    <FormControl>
                      <Input placeholder="Cognome del carcerato" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="motivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo della richiesta di grazia</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descrivi il motivo per cui chiedi la grazia per questo carcerato" 
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="dettagli"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dettagli aggiuntivi (opzionale)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Aggiungi dettagli aggiuntivi sul caso" 
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Annulla
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Invio in corso..." : "Proponi Carcerato"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
