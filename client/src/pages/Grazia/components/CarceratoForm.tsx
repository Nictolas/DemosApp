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
    <Card className="mb-6 bg-white">
      <CardHeader>
        <CardTitle>Proponi Carcerato</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4 bg-blue-50 border-blue-200">
          <AlertTriangle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>INFORMAZIONI IMPORTANTI:</strong> Sarai contattato via email dallo staff. Sarà necessario inviare una Copia della Sentenza di Condanna Definitiva per accertarsi che la persona proposta sia reale. Dopo la conferma e l'aggiunta sull'app, il documento ricevuto sarà cancellato dal nostro archivio.
          </AlertDescription>
        </Alert>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="La tua email per essere contattato" 
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
