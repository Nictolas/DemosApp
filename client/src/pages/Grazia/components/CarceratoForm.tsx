import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { carceratoSchema, DEFAULT_FORM_VALUES, CarceratoFormData } from "../constants/schema";

interface CarceratoFormProps {
  onSubmit: (data: CarceratoFormData) => void | Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export const CarceratoForm: React.FC<CarceratoFormProps> = ({ onSubmit, onCancel, isLoading }) => {
  const form = useForm<CarceratoFormData>({
    resolver: zodResolver(carceratoSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  return (
    <Card className="mb-6 bg-white">
      <CardHeader>
        <CardTitle>Proponi una persona per Grazia</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4 bg-blue-50 border-blue-200">
          <AlertTriangle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            La proposta non sarà pubblicata automaticamente. Sarà esaminata dall'amministratore.
            Inserisci soltanto una fonte pubblica: non inviare sentenze, documenti o altri dati giudiziari.
          </AlertDescription>
        </Alert>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome della persona</FormLabel>
                  <FormControl><Input placeholder="Nome e cognome" autoComplete="off" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="urlProva"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fonte pubblica HTTPS</FormLabel>
                  <FormControl><Input type="url" placeholder="https://..." autoComplete="off" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={isLoading} onClick={onCancel}>Annulla</Button>
              <Button type="submit" disabled={isLoading}>{isLoading ? "Invio in corso..." : "Invia per revisione"}</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
