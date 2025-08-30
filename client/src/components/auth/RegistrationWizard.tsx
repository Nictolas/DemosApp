import React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RegistrationData {
  email: string;
  password: string;
  nome: string;
  cognome: string;
  genere: string;
  cittadinanza: string;
}

interface RegistrationWizardProps {
  onComplete: (data: RegistrationData) => void;
  onCancel: () => void;
  defaultValues?: Partial<RegistrationData>;
}

export function RegistrationWizard({ onComplete, onCancel, defaultValues }: RegistrationWizardProps) {
  const form = useForm<RegistrationData>({
    defaultValues: {
      email: defaultValues?.email || "",
      password: defaultValues?.password || "",
      nome: defaultValues?.nome || "",
      cognome: defaultValues?.cognome || "",
      genere: defaultValues?.genere || "",
      cittadinanza: defaultValues?.cittadinanza || "",
    }
  });

  const onSubmit = (data: RegistrationData) => {
    onComplete(data);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="shadow-lg">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl font-bold text-gray-800">
            Registrazione Account
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Email e Password */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <Input
                  {...form.register("email", { required: "Email obbligatoria" })}
                  type="email"
                  placeholder="email@esempio.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password *</label>
                <Input
                  {...form.register("password", { required: "Password obbligatoria" })}
                  type="password"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Nome e Cognome */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome *</label>
                <Input
                  {...form.register("nome", { required: "Nome obbligatorio" })}
                  placeholder="Il tuo nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cognome *</label>
                <Input
                  {...form.register("cognome", { required: "Cognome obbligatorio" })}
                  placeholder="Il tuo cognome"
                />
              </div>
            </div>

            {/* Genere e Cittadinanza */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Genere *</label>
                <select
                  {...form.register("genere", { required: "Genere obbligatorio" })}
                  className="w-full rounded-md border border-input px-3 py-2"
                >
                  <option value="">Seleziona genere</option>
                  <option value="uomo">Uomo</option>
                  <option value="donna">Donna</option>
                  <option value="altro">Altro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cittadinanza *</label>
                <select
                  {...form.register("cittadinanza", { required: "Cittadinanza obbligatoria" })}
                  className="w-full rounded-md border border-input px-3 py-2"
                >
                  <option value="">Seleziona cittadinanza</option>
                  <option value="italiana">Italiana</option>
                  <option value="europea">Europea</option>
                  <option value="extra-ue">Extra-UE</option>
                </select>
              </div>
            </div>

            {/* Pulsanti */}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                Annulla
              </Button>
              <Button type="submit" className="flex-1">
                Completa Registrazione
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
