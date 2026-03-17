import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";

const phase4Schema = z.object({
  ruolo: z.string().default("Elettore"),
  paese_elezione: z.string().optional(),
  regione_elezione: z.string().optional(),
  provincia_elezione: z.string().optional(),
  comune_elezione: z.string().optional(),
  paese_candidatura: z.string().optional(),
  regione_candidatura: z.string().optional(),
  provincia_candidatura: z.string().optional(),
  comune_candidatura: z.string().optional(),
  grado_elezione: z.string().optional(),
  grado_candidatura: z.string().optional(),
});

type Phase4Values = z.infer<typeof phase4Schema>;

interface Phase4RoleProps {
  onSubmit: (data: Phase4Values) => void;
  onBack: () => void;
  defaultValues?: Partial<Phase4Values>;
}

export function Phase4Role({ onSubmit, onBack, defaultValues }: Phase4RoleProps) {
  const form = useForm<Phase4Values>({
    resolver: zodResolver(phase4Schema),
    defaultValues: {
      ruolo: "Elettore", // Ruolo automaticamente impostato a "Elettore"
      paese_elezione: defaultValues?.paese_elezione || "",
      regione_elezione: defaultValues?.regione_elezione || "",
      provincia_elezione: defaultValues?.provincia_elezione || "",
      comune_elezione: defaultValues?.comune_elezione || "",
      paese_candidatura: defaultValues?.paese_candidatura || "",
      regione_candidatura: defaultValues?.regione_candidatura || "",
      provincia_candidatura: defaultValues?.provincia_candidatura || "",
      comune_candidatura: defaultValues?.comune_candidatura || "",
      grado_elezione: defaultValues?.grado_elezione || "",
      grado_candidatura: defaultValues?.grado_candidatura || "",
    },
  });

  const handleSubmit = (data: Phase4Values) => {
    // Assicurati che il ruolo sia sempre "Elettore"
    onSubmit({ ...data, ruolo: "Elettore" });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold">Completamento Registrazione</h3>
        </div>

        {/* Informazione Ruolo - automaticamente impostato a Elettore */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🙋‍♂️</span>
            <div>
              <div className="font-semibold text-blue-900">Ruolo: Elettore</div>
              <div className="text-sm text-blue-700 mt-1">Tutti i nuovi utenti vengono registrati automaticamente come Elettore</div>
            </div>
          </div>
        </div>

        {/* I campi di elezione e candidatura non sono più necessari per gli Elettori */}

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            Indietro
          </Button>
          <Button type="submit" className="flex-1">
            Completa Registrazione
          </Button>
        </div>
      </form>
    </Form>
  );
}
