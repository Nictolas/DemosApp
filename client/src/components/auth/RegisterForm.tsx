import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { registerSchema, RegisterFormValues } from "./authSchemas";
import { useGeographicSelections } from "./useGeographicSelections";
import { useBirthDate } from "./useBirthDate";
import CodiceFiscaleInput from "@/components/CodiceFiscaleInput";

// 🚨 SELECT NATIVI PER ELIMINARE IL PROBLEMA DI RENDERING
function NativeSelect({ 
  value, 
  onValueChange, 
  children, 
  className = "",
  placeholder = "Seleziona..."
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={`w-full p-2 border border-gray-300 rounded-md bg-white text-black ${className}`}
      style={{
        backgroundColor: 'white',
        color: 'black',
        border: '1px solid #d1d5db',
        fontSize: '14px',
        height: '40px'
      }}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

function NativeSelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return <option value={value}>{children}</option>;
}


interface RegisterFormProps {
  onSubmit: (data: RegisterFormValues) => void;
  isLoading: boolean;
  error?: string;
  requiresVerification?: boolean;
  onResendVerification: (email: string) => Promise<void>;
}

export function RegisterForm({ 
  onSubmit, 
  isLoading, 
  error, 
  requiresVerification, 
  onResendVerification 
}: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      codice_fiscale: "",
      nome: "",
      cognome: "",
      data_nascita: "",
      genere: "",
      cittadinanza: "",
      paese_residenza: "",
      regione_residenza: "",
      provincia_residenza: "",
      comune_residenza: "",
      paese_elezione: "",
      regione_elezione: "",
      provincia_elezione: "",
      comune_elezione: "",
      paese_candidatura: "",
      regione_candidatura: "",
      provincia_candidatura: "",
      comune_candidatura: "",
      ruolo: "",
      grado_elezione: "",
      grado_candidatura: "",
    },
  });

  const geographicSelections = useGeographicSelections(form.watch);
  const birthDate = useBirthDate(form.setValue);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        {/* Informazioni base */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Nome" {...field} />
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
                <FormLabel>Cognome</FormLabel>
                <FormControl>
                  <Input placeholder="Cognome" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Email e Password */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      {...field}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.458 12C2.732 16.057 6.523 19 12 19c1.306 0 2.555-.154 3.722-.44M21.542 12c-.274.857-.67 1.664-1.176 2.398M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.022-3.777A10.45 10.45 0 0122.542 12c-1.274 4.057-5.065 7-10.542 7-1.306 0-2.555-.154-3.722-.44M6.222 4.44A10.45 10.45 0 0112 5c4.478 0 8.268 2.943 9.542 7-.274.857-.67 1.664-1.176 2.398M9.88 9.88l4.24 4.24m0-4.24l-4.24 4.24" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.857-.67 1.664-1.176 2.398" />
                        </svg>
                      )}
                    </button>
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
                <FormLabel>Conferma Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Conferma password"
                      {...field}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                      tabIndex={-1}
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? "Nascondi password" : "Mostra password"}
                    >
                      {showConfirmPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.458 12C2.732 16.057 6.523 19 12 19c1.306 0 2.555-.154 3.722-.44M21.542 12c-.274.857-.67 1.664-1.176 2.398M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.022-3.777A10.45 10.45 0 0122.542 12c-1.274 4.057-5.065 7-10.542 7-1.306 0-2.555-.154-3.722-.44M6.222 4.44A10.45 10.45 0 0112 5c4.478 0 8.268 2.943 9.542 7-.274.857-.67 1.664-1.176 2.398M9.88 9.88l4.24 4.24m0-4.24l-4.24 4.24" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.857-.67 1.664-1.176 2.398" />
                        </svg>
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Codice Fiscale */}
        <FormField
          control={form.control}
          name="codice_fiscale"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <CodiceFiscaleInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Codice Fiscale"
                  label=""
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Data di Nascita */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Data di Nascita</h3>
          <div className="grid grid-cols-3 gap-4">
          <FormItem>
            <FormLabel>Giorno</FormLabel>
            <NativeSelect value={birthDate.birthDay} onValueChange={birthDate.setBirthDay}>
              {birthDate.days.map((day) => (
                <NativeSelectItem key={day} value={day}>{day}</NativeSelectItem>
              ))}
            </NativeSelect>
          </FormItem>
          <FormItem>
            <FormLabel>Mese</FormLabel>
            <NativeSelect value={birthDate.birthMonth} onValueChange={birthDate.setBirthMonth}>
              {birthDate.months.map((month) => (
                <NativeSelectItem key={month.value} value={month.value}>{month.label}</NativeSelectItem>
              ))}
            </NativeSelect>
          </FormItem>
          <FormItem>
            <FormLabel>Anno</FormLabel>
            <NativeSelect value={birthDate.birthYear} onValueChange={birthDate.setBirthYear}>
              {birthDate.years.map((year) => (
                <NativeSelectItem key={year} value={year}>{year}</NativeSelectItem>
              ))}
            </NativeSelect>
          </FormItem>
        </div>
        </div>

        {/* Genere e Cittadinanza */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="genere"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Genere</FormLabel>
                <NativeSelect onValueChange={field.onChange} value={field.value}>
                  <NativeSelectItem value="uomo">Uomo</NativeSelectItem>
                  <NativeSelectItem value="donna">Donna</NativeSelectItem>
                  <NativeSelectItem value="altro">Altro</NativeSelectItem>
                </NativeSelect>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cittadinanza"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cittadinanza</FormLabel>
                <NativeSelect onValueChange={field.onChange} value={field.value}>
                  <NativeSelectItem value="Italiana">Italiana</NativeSelectItem>
                  <NativeSelectItem value="Francese">Francese</NativeSelectItem>
                  <NativeSelectItem value="Tedesca">Tedesca</NativeSelectItem>
                  <NativeSelectItem value="Spagnola">Spagnola</NativeSelectItem>
                  <NativeSelectItem value="Portoghese">Portoghese</NativeSelectItem>
                  <NativeSelectItem value="Austriaca">Austriaca</NativeSelectItem>
                  <NativeSelectItem value="Belga">Belga</NativeSelectItem>
                  <NativeSelectItem value="Olandese">Olandese</NativeSelectItem>
                  <NativeSelectItem value="Svedese">Svedese</NativeSelectItem>
                  <NativeSelectItem value="Danese">Danese</NativeSelectItem>
                  <NativeSelectItem value="Finlandese">Finlandese</NativeSelectItem>
                  <NativeSelectItem value="Norvegese">Norvegese</NativeSelectItem>
                  <NativeSelectItem value="Svizzera">Svizzera</NativeSelectItem>
                  <NativeSelectItem value="Greca">Greca</NativeSelectItem>
                  <NativeSelectItem value="Polacca">Polacca</NativeSelectItem>
                  <NativeSelectItem value="Ceca">Ceca</NativeSelectItem>
                  <NativeSelectItem value="Slovacca">Slovacca</NativeSelectItem>
                  <NativeSelectItem value="Ungherese">Ungherese</NativeSelectItem>
                  <NativeSelectItem value="Romena">Romena</NativeSelectItem>
                  <NativeSelectItem value="Bulgaro">Bulgaro</NativeSelectItem>
                  <NativeSelectItem value="Croata">Croata</NativeSelectItem>
                  <NativeSelectItem value="Slovena">Slovena</NativeSelectItem>
                  <NativeSelectItem value="Lituana">Lituana</NativeSelectItem>
                  <NativeSelectItem value="Lettone">Lettone</NativeSelectItem>
                  <NativeSelectItem value="Estoniana">Estoniana</NativeSelectItem>
                  <NativeSelectItem value="Maltese">Maltese</NativeSelectItem>
                  <NativeSelectItem value="Cipriota">Cipriota</NativeSelectItem>
                  <NativeSelectItem value="Lussemburghese">Lussemburghese</NativeSelectItem>
                  <NativeSelectItem value="Irlandese">Irlandese</NativeSelectItem>
                  <NativeSelectItem value="Altra">Altra</NativeSelectItem>
                </NativeSelect>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Ruolo */}
        <FormField
          control={form.control}
          name="ruolo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ruolo</FormLabel>
              <NativeSelect onValueChange={field.onChange} value={field.value}>
                <NativeSelectItem value="Elettore">Elettore</NativeSelectItem>
                <NativeSelectItem value="Politico">Politico</NativeSelectItem>
                <NativeSelectItem value="Candidato">Candidato</NativeSelectItem>
                <NativeSelectItem value="Candidato Politico">Candidato Politico</NativeSelectItem>
              </NativeSelect>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Residenza */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Residenza</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="paese_residenza"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paese</FormLabel>
                  <NativeSelect onValueChange={field.onChange} value={field.value}>
                    <NativeSelectItem value="Italia">Italia</NativeSelectItem>
                    <NativeSelectItem value="Altro">Altro</NativeSelectItem>
                  </NativeSelect>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="regione_residenza"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Regione</FormLabel>
                  <NativeSelect onValueChange={field.onChange} value={field.value} disabled={geographicSelections.regioniResidenza.length === 0}>
                    {geographicSelections.regioniResidenza.map((regione) => (
                      <NativeSelectItem key={regione} value={regione}>{regione}</NativeSelectItem>
                    ))}
                  </NativeSelect>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="provincia_residenza"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provincia</FormLabel>
                  <NativeSelect onValueChange={field.onChange} value={field.value} disabled={geographicSelections.provinceResidenza.length === 0}>
                    {geographicSelections.provinceResidenza.map((provincia) => (
                      <NativeSelectItem key={provincia} value={provincia}>{provincia}</NativeSelectItem>
                    ))}
                  </NativeSelect>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="comune_residenza"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comune</FormLabel>
                  <NativeSelect onValueChange={field.onChange} value={field.value} disabled={geographicSelections.comuniResidenza.length === 0}>
                    {geographicSelections.comuniResidenza.map((comune) => (
                      <NativeSelectItem key={comune} value={comune}>{comune}</NativeSelectItem>
                    ))}
                  </NativeSelect>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Elezione (per Politico e Candidato Politico) */}
        {(form.watch("ruolo") === "Politico" || form.watch("ruolo") === "Candidato Politico") && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Elezione</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="paese_elezione"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paese di Elezione</FormLabel>
                    <NativeSelect onValueChange={field.onChange} value={field.value}>
                      <NativeSelectItem value="Italia">Italia</NativeSelectItem>
                      <NativeSelectItem value="Altro">Altro</NativeSelectItem>
                    </NativeSelect>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="regione_elezione"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regione di Elezione</FormLabel>
                    <NativeSelect onValueChange={field.onChange} value={field.value} disabled={geographicSelections.regioniElezione.length === 0}>
                      {geographicSelections.regioniElezione.map((regione) => (
                        <NativeSelectItem key={regione} value={regione}>{regione}</NativeSelectItem>
                      ))}
                    </NativeSelect>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="provincia_elezione"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provincia di Elezione</FormLabel>
                    <NativeSelect onValueChange={field.onChange} value={field.value} disabled={geographicSelections.provinceElezione.length === 0}>
                      {geographicSelections.provinceElezione.map((provincia) => (
                        <NativeSelectItem key={provincia} value={provincia}>{provincia}</NativeSelectItem>
                      ))}
                    </NativeSelect>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="comune_elezione"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comune di Elezione</FormLabel>
                    <NativeSelect onValueChange={field.onChange} value={field.value} disabled={geographicSelections.comuniElezione.length === 0}>
                      {geographicSelections.comuniElezione.map((comune) => (
                        <NativeSelectItem key={comune} value={comune}>{comune}</NativeSelectItem>
                      ))}
                    </NativeSelect>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {/* Candidatura (per Candidato e Candidato Politico) */}
        {(form.watch("ruolo") === "Candidato" || form.watch("ruolo") === "Candidato Politico") && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Candidatura</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="paese_candidatura"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paese di Candidatura</FormLabel>
                    <NativeSelect onValueChange={field.onChange} value={field.value}>
                      <NativeSelectItem value="Italia">Italia</NativeSelectItem>
                      <NativeSelectItem value="Altro">Altro</NativeSelectItem>
                    </NativeSelect>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="regione_candidatura"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regione di Candidatura</FormLabel>
                    <NativeSelect onValueChange={field.onChange} value={field.value} disabled={geographicSelections.regioniCandidatura.length === 0}>
                      {geographicSelections.regioniCandidatura.map((regione) => (
                        <NativeSelectItem key={regione} value={regione}>{regione}</NativeSelectItem>
                      ))}
                    </NativeSelect>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="provincia_candidatura"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provincia di Candidatura</FormLabel>
                    <NativeSelect onValueChange={field.onChange} value={field.value} disabled={geographicSelections.provinceCandidatura.length === 0}>
                      {geographicSelections.provinceCandidatura.map((provincia) => (
                        <NativeSelectItem key={provincia} value={provincia}>{provincia}</NativeSelectItem>
                      ))}
                    </NativeSelect>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="comune_candidatura"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comune di Candidatura</FormLabel>
                  <NativeSelect onValueChange={field.onChange} value={field.value} disabled={geographicSelections.comuniCandidatura.length === 0}>
                      {geographicSelections.comuniCandidatura.map((comune) => (
                        <NativeSelectItem key={comune} value={comune}>{comune}</NativeSelectItem>
                      ))}
                    </NativeSelect>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        <Button 
          type="submit" 
          variant="default"
          size="lg"
          className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 text-base rounded-lg shadow-md transition-all duration-200 hover:shadow-lg" 
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Registrazione in corso...
            </>
          ) : (
            "Registrati"
          )}
        </Button>

        {error && (
          <div className="text-red-600 text-sm mt-2">{error}</div>
        )}

        {requiresVerification && (
          <div className="flex flex-col items-center mt-2">
            <span className="text-green-600 text-sm mb-2">
              Registrazione completata! Controlla la tua email per confermare l'account.
            </span>
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => onResendVerification(form.getValues().email)}
            >
              Reinvia email di verifica
            </Button>
          </div>
        )}
        

      </form>
    </Form>
  );
}
