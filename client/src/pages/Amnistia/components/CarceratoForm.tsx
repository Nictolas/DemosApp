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
import { amnistiaSchema, DEFAULT_FORM_VALUES, AmnistiaFormData } from "../constants/schema";

interface CarceratoFormProps {
  onSubmit: (data: AmnistiaFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export const CarceratoForm: React.FC<CarceratoFormProps> = ({ onSubmit, onCancel, isLoading }) => {
  const form = useForm({
    resolver: zodResolver(amnistiaSchema),
    defaultValues: DEFAULT_FORM_VALUES
  });

  const handleSubmit = (data: AmnistiaFormData) => {
    onSubmit(data);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Proponi Amnistia</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4 bg-yellow-50 border-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>ATTENZIONE:</strong> Per proporre un'amnistia, assicurati di avere 
            informazioni verificate e documentate sul caso.
          </AlertDescription>
        </Alert>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="legge"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legge</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome della legge" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="articolo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Articolo</FormLabel>
                  <FormControl>
                    <Input placeholder="Numero dell'articolo" {...field} />
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
                      placeholder="Descrivi l'amnistia richiesta" 
                      className="min-h-[100px]"
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
                {isLoading ? "Invio in corso..." : "Proponi Amnistia"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
