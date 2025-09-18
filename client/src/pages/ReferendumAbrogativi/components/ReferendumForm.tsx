import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2 } from "lucide-react";
import { ReferendumFormProps } from "../types";

export const ReferendumForm: React.FC<ReferendumFormProps> = ({
  form,
  onSubmit,
  onCancel,
  isPending,
  title
}) => {
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Plus className="mr-2 h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>
          Compila i campi per creare un nuovo referendum abrogativo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome del Referendum *</FormLabel>
                  <FormControl>
                    <Input placeholder="Inserisci il nome del referendum" {...field} />
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
                  <FormLabel>Descrizione *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descrivi brevemente il referendum abrogativo"
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
                    <FormLabel>Data di Inizio *</FormLabel>
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
                    <FormLabel>Data di Fine *</FormLabel>
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
                  <FormLabel>Sito Web (opzionale)</FormLabel>
                  <FormControl>
                    <Input 
                      type="url" 
                      placeholder="https://esempio.com" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Annulla
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  "Salva Referendum"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
