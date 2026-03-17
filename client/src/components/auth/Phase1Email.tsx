import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Eye, EyeOff } from "lucide-react";

const phase1Schema = z.object({
  email: z.string().email("Inserisci un'email valida").min(3, "L'email deve contenere almeno 3 caratteri"),
  password: z.string().min(6, "La password deve contenere almeno 6 caratteri"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Le password non corrispondono",
  path: ["confirmPassword"],
});

type Phase1Values = z.infer<typeof phase1Schema>;

interface Phase1EmailProps {
  onNext: (data: Phase1Values) => void;
  defaultValues?: Partial<Phase1Values>;
}

export function Phase1Email({ onNext, defaultValues }: Phase1EmailProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<Phase1Values>({
    resolver: zodResolver(phase1Schema),
    defaultValues: {
      email: defaultValues?.email || "",
      password: defaultValues?.password || "",
      confirmPassword: defaultValues?.confirmPassword || "",
    },
  });

  const onSubmit = (data: Phase1Values) => {
    onNext(data);
  };

  // Se le credenziali sono già fornite, mostra un riepilogo
  if (defaultValues?.email && defaultValues?.password) {
    return (
      <div className="text-center space-y-4">
        <h3 className="text-lg font-semibold">Credenziali Confermate</h3>
        <p className="text-sm text-muted-foreground">Le tue credenziali sono già state inserite</p>
        
        <div className="bg-gray-50 p-4 rounded-lg text-left">
          <p><strong>Email:</strong> {defaultValues.email}</p>
          <p><strong>Password:</strong> ••••••••</p>
        </div>
        
        <Button 
          onClick={() => onNext({ 
            email: defaultValues.email!, 
            password: defaultValues.password!, 
            confirmPassword: defaultValues.password! 
          })}
          className="w-full"
        >
          Procedi ai Dati Personali
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold">Credenziali</h3>
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder="la-tua-email@esempio.com"
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password *</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    type={showPassword ? "text" : "password"}
                    placeholder="Inserisci la password"
                    className="w-full pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conferma Password *</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Conferma la password"
                    className="w-full pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          Continua
        </Button>
      </form>
    </Form>
  );
}
