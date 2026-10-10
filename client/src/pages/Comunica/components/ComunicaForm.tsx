import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Loader2 } from "lucide-react";
import { useComunicaForm } from "../hooks/useComunicaForm";

export const ComunicaForm: React.FC = () => {
  const { form, onSubmit, submitComunicazione } = useComunicaForm();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          Comunica voto istituzionale
        </CardTitle>
        <CardDescription>
          Pubblica come hai votato in una votazione istituzionale.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="titolo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Votazione / decisione istituzionale</FormLabel>
                  <FormControl>
                    <Input placeholder="Inserisci il titolo..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="data_votazione"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data della votazione</FormLabel>
                  <FormControl>
                    <Input type="date" max={today} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                  Comunica voto
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
