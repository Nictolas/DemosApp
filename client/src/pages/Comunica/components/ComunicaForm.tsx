import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useComunicaForm } from "../hooks/useComunicaForm";

export const ComunicaForm: React.FC = () => {
  const { form, existingComunicazione, checkingDuplicate, checkDuplicate, onSubmit, submitComunicazione } = useComunicaForm();

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Nuova Comunicazione</CardTitle>
        <CardDescription>
          Invia una nuova comunicazione politica
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Titolo */}
            <FormField
              control={form.control}
              name="titolo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titolo della comunicazione</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Inserisci il titolo..."
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        checkDuplicate(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  {checkingDuplicate && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Controllo duplicati...
                    </div>
                  )}
                </FormItem>
              )}
            />

            {/* Alert per comunicazione esistente */}
            {existingComunicazione && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Comunicazione già esistente</AlertTitle>
                <AlertDescription>
                  Esiste già una comunicazione con questo titolo nella zona {existingComunicazione.zona}.
                  Il vincitore è stato preimpostato a: <Badge variant="outline" className="ml-1">{existingComunicazione.vincitore}</Badge>
                </AlertDescription>
              </Alert>
            )}

            {/* Voto dato */}
            <FormField
              control={form.control}
              name="voto_dato"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Il tuo voto</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona il tuo voto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Favorevole">Favorevole</SelectItem>
                      <SelectItem value="Contrario">Contrario</SelectItem>
                      <SelectItem value="Astenuto">Astenuto</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Commento */}
            <FormField
              control={form.control}
              name="commento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commento (opzionale, max 20 caratteri)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Inserisci un commento..."
                      {...field}
                      maxLength={20}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Vincitore */}
            <FormField
              control={form.control}
              name="vincitore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vincitore previsto</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona il vincitore previsto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Favorevole">Favorevole</SelectItem>
                      <SelectItem value="Contrario">Contrario</SelectItem>
                      <SelectItem value="Astenuto">Astenuto</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitComunicazione.isPending}
              className="w-full"
            >
              {submitComunicazione.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Invio in corso...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Invia Comunicazione
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
