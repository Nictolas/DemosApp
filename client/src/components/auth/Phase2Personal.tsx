import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CodiceFiscaleInput from "@/components/CodiceFiscaleInput";

const phase2Schema = z.object({
  codice_fiscale: z.string().min(16, "Il codice fiscale deve essere di 16 caratteri").max(16, "Il codice fiscale deve essere di 16 caratteri"),
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
      codice_fiscale: defaultValues?.codice_fiscale || "",
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

        <FormField
          control={form.control}
          name="codice_fiscale"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Codice Fiscale *</FormLabel>
              <FormControl>
                <CodiceFiscaleInput
                  {...field}
                  placeholder="Codice Fiscale"
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona genere" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="uomo">Uomo</SelectItem>
                    <SelectItem value="donna">Donna</SelectItem>
                    <SelectItem value="altro">Altro</SelectItem>
                  </SelectContent>
                </Select>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona cittadinanza" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="italiana">Italiana</SelectItem>
                    <SelectItem value="europea">Europea</SelectItem>
                    <SelectItem value="extra-ue">Extra-UE</SelectItem>
                  </SelectContent>
                </Select>
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
