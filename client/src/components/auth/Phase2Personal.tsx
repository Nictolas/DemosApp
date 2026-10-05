import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const phase2Schema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  cognome: z.string().min(1, "Il cognome è obbligatorio"),
  data_nascita: z.string().min(1, "La data di nascita è obbligatoria"),
  genere: z.string().min(1, "Il genere è obbligatorio"),
  cittadinanza: z.string().min(1, "La cittadinanza è obbligatoria"),
});

type Phase2Values = z.infer<typeof phase2Schema>;

interface Phase2PersonalProps {
  onNext: (data: Phase2Values) => void;
  onBack: () => void;
  defaultValues?: Partial<Phase2Values>;
}

export function Phase2Personal({ onNext, onBack, defaultValues }: Phase2PersonalProps) {
  const form = useForm<Phase2Values>({
    resolver: zodResolver(phase2Schema),
    defaultValues: {
      nome: defaultValues?.nome || "",
      cognome: defaultValues?.nome || "",
      data_nascita: defaultValues?.data_nascita || "",
      genere: defaultValues?.genere || "",
      cittadinanza: defaultValues?.cittadinanza || "",
    },
  });

  const onSubmit = (data: Phase2Values) => {
    onNext(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold">Dati Personali</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Il tuo nome"
                    className="w-full"
                  />
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
                <FormLabel>Cognome *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Il tuo cognome"
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="data_nascita"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data di Nascita *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="date"
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="genere"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Genere *</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Seleziona genere</option>
                    <option value="uomo">Uomo</option>
                    <option value="donna">Donna</option>
                    <option value="altro">Altro</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cittadinanza"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cittadinanza *</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Seleziona cittadinanza</option>
                    <option value="italiana">Italiana</option>
                    <option value="europea">Europea</option>
                    <option value="extra-ue">Extra-UE</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            Indietro
          </Button>
          <Button type="submit" className="flex-1">
            Continua
          </Button>
        </div>
      </form>
    </Form>
  );
}
