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
    <Card className="mb-6 border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100">
        <CardTitle className="text-xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-bold">
          Proponi Amnistia
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 shadow-md">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800 font-medium">
            <strong>Proposte sospese:</strong> L'invio verrà riattivato quando sarà pronto il controllo amministrativo. Nel frattempo non raccogliamo nuove richieste.
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
            
            <div className="flex justify-end space-x-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                className="hover:bg-gray-100 transition-colors"
              >
                Annulla
              </Button>
              <Button 
                type="submit" 
                disabled={true} aria-disabled="true"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
              >
                Proposte temporaneamente sospese
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
