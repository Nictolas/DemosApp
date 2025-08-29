import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { registerSchema, RegisterFormValues } from "./authSchemas";
import { useGeographicSelections } from "./useGeographicSelections";
import { useBirthDate } from "./useBirthDate";
import CodiceFiscaleInput from "@/components/CodiceFiscaleInput";

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
                  onBlur={field.onBlur}
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
            <Select value={birthDate.birthDay} onValueChange={birthDate.setBirthDay}>
              <SelectTrigger>
                <SelectValue placeholder="Giorno" />
              </SelectTrigger>
              <SelectContent>
                {birthDate.days.map((day) => (
                  <SelectItem key={day} value={day}>{day}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
          <FormItem>
            <FormLabel>Mese</FormLabel>
            <Select value={birthDate.birthMonth} onValueChange={birthDate.setBirthMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Mese" />
              </SelectTrigger>
              <SelectContent>
                {birthDate.months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
          <FormItem>
            <FormLabel>Anno</FormLabel>
            <Select value={birthDate.birthYear} onValueChange={birthDate.setBirthYear}>
              <SelectTrigger>
                <SelectValue placeholder="Anno" />
              </SelectTrigger>
              <SelectContent>
                {birthDate.years.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona genere" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Uomo">Uomo</SelectItem>
                    <SelectItem value="Donna">Donna</SelectItem>
                    <SelectItem value="Altro">Altro</SelectItem>
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
                <FormLabel>Cittadinanza</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona cittadinanza" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Italiana">Italiana</SelectItem>
                    <SelectItem value="Francese">Francese</SelectItem>
                    <SelectItem value="Tedesca">Tedesca</SelectItem>
                    <SelectItem value="Spagnola">Spagnola</SelectItem>
                    <SelectItem value="Portoghese">Portoghese</SelectItem>
                    <SelectItem value="Austriaca">Austriaca</SelectItem>
                    <SelectItem value="Belga">Belga</SelectItem>
                    <SelectItem value="Olandese">Olandese</SelectItem>
                    <SelectItem value="Svedese">Svedese</SelectItem>
                    <SelectItem value="Danese">Danese</SelectItem>
                    <SelectItem value="Finlandese">Finlandese</SelectItem>
                    <SelectItem value="Norvegese">Norvegese</SelectItem>
                    <SelectItem value="Svizzera">Svizzera</SelectItem>
                    <SelectItem value="Greca">Greca</SelectItem>
                    <SelectItem value="Polacca">Polacca</SelectItem>
                    <SelectItem value="Ceca">Ceca</SelectItem>
                    <SelectItem value="Slovacca">Slovacca</SelectItem>
                    <SelectItem value="Ungherese">Ungherese</SelectItem>
                    <SelectItem value="Romena">Romena</SelectItem>
                    <SelectItem value="Bulgaro">Bulgaro</SelectItem>
                    <SelectItem value="Croata">Croata</SelectItem>
                    <SelectItem value="Slovena">Slovena</SelectItem>
                    <SelectItem value="Lituana">Lituana</SelectItem>
                    <SelectItem value="Lettone">Lettone</SelectItem>
                    <SelectItem value="Estoniana">Estoniana</SelectItem>
                    <SelectItem value="Maltese">Maltese</SelectItem>
                    <SelectItem value="Cipriota">Cipriota</SelectItem>
                    <SelectItem value="Lussemburghese">Lussemburghese</SelectItem>
                    <SelectItem value="Irlandese">Irlandese</SelectItem>
                    <SelectItem value="Altra">Altra</SelectItem>
                  </SelectContent>
                </Select>
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
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona ruolo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Elettore">Elettore</SelectItem>
                  <SelectItem value="Politico">Politico</SelectItem>
                  <SelectItem value="Candidato">Candidato</SelectItem>
                  <SelectItem value="Candidato Politico">Candidato Politico</SelectItem>
                </SelectContent>
              </Select>
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona paese" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Italia">Italia</SelectItem>
                      <SelectItem value="Altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={geographicSelections.regioniResidenza.length === 0}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona regione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {geographicSelections.regioniResidenza.map((regione) => (
                        <SelectItem key={regione} value={regione}>{regione}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={geographicSelections.provinceResidenza.length === 0}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona provincia" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {geographicSelections.provinceResidenza.map((provincia) => (
                        <SelectItem key={provincia} value={provincia}>{provincia}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={geographicSelections.comuniResidenza.length === 0}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona comune" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {geographicSelections.comuniResidenza.map((comune) => (
                        <SelectItem key={comune} value={comune}>{comune}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona paese" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Italia">Italia</SelectItem>
                        <SelectItem value="Altro">Altro</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={geographicSelections.regioniElezione.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona regione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {geographicSelections.regioniElezione.map((regione) => (
                          <SelectItem key={regione} value={regione}>{regione}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={geographicSelections.provinceElezione.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona provincia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {geographicSelections.provinceElezione.map((provincia) => (
                          <SelectItem key={provincia} value={provincia}>{provincia}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={geographicSelections.comuniElezione.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona comune" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {geographicSelections.comuniElezione.map((comune) => (
                          <SelectItem key={comune} value={comune}>{comune}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona paese" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Italia">Italia</SelectItem>
                        <SelectItem value="Altro">Altro</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={geographicSelections.regioniCandidatura.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona regione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {geographicSelections.regioniCandidatura.map((regione) => (
                          <SelectItem key={regione} value={regione}>{regione}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={geographicSelections.provinceCandidatura.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona provincia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {geographicSelections.provinceCandidatura.map((provincia) => (
                          <SelectItem key={provincia} value={provincia}>{provincia}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={geographicSelections.comuniCandidatura.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona comune" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {geographicSelections.comuniCandidatura.map((comune) => (
                          <SelectItem key={comune} value={comune}>{comune}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
