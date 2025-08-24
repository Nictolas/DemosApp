import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Picker from "react-mobile-picker";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ITALY_DATA } from "@/data/italyData";
import { apiRequest } from "@/lib/queryClient";
import CodiceFiscaleInput from "./CodiceFiscaleInput"; 

 // Form schema with validation
 const formSchema = z.object({
   nome: z.string().min(1, "Il nome è obbligatorio"),
   cognome: z.string().min(1, "Il cognome è obbligatorio"),
   codice_fiscale: z.string().min(16, "Il codice fiscale deve essere di 16 caratteri").max(16, "Il codice fiscale deve essere di 16 caratteri").min(1, "Il codice fiscale è obbligatorio"),
   email: z.string().email("Email non valida").min(1, "L'email è obbligatoria"),
   data_nascita: z.string().min(1, "La data di nascita è obbligatoria"),
   genere: z.string().min(1, "Il genere è obbligatorio"),
   cittadinanza: z.string().min(1, "La cittadinanza è obbligatoria"),
  
  paese_residenza: z.string().min(1, "Il paese di residenza è obbligatorio"),
  regione_residenza: z.string().min(1, "La regione di residenza è obbligatoria"),
  provincia_residenza: z.string().min(1, "La provincia di residenza è obbligatoria"),
  comune_residenza: z.string().min(1, "Il comune di residenza è obbligatorio"),
  
  paese_elezione: z.string().optional(),
  regione_elezione: z.string().optional(),
  provincia_elezione: z.string().optional(),
  comune_elezione: z.string().optional(),
  
  paese_candidatura: z.string().optional(),
  regione_candidatura: z.string().optional(),
  provincia_candidatura: z.string().optional(),
  comune_candidatura: z.string().optional(),
  
  ruolo: z.string().min(1, "Il ruolo è obbligatorio"),
  grado_elezione: z.string().optional(),
  grado_candidatura: z.string().optional(),
  password: z.string().min(6, "La password deve essere di almeno 6 caratteri"),
  confirmPassword: z.string().min(6, "Conferma la password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Le password non coincidono",
  path: ["confirmPassword"],
});

type FormValues = z.infer<typeof formSchema>;

export default function UserRegistrationForm() {
  const { toast } = useToast();
  
  // Form state
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      cognome: "",
      codice_fiscale: "",
      email: "",
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
      password: "",
      confirmPassword: ""
    },
  });
  
  // Dynamic select options state
  const [regioniResidenza, setRegioniResidenza] = useState<string[]>([]);
  const [provinceResidenza, setProvinceResidenza] = useState<string[]>([]);
  const [comuniResidenza, setComuniResidenza] = useState<string[]>([]);
  
  const [regioniElezione, setRegioniElezione] = useState<string[]>([]);
  const [provinceElezione, setProvinceElezione] = useState<string[]>([]);
  const [comuniElezione, setComuniElezione] = useState<string[]>([]);
  
  const [regioniCandidatura, setRegioniCandidatura] = useState<string[]>([]);
  const [provinceCandidatura, setProvinceCandidatura] = useState<string[]>([]);
  const [comuniCandidatura, setComuniCandidatura] = useState<string[]>([]);
  
  // Password state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // 1. Stati per giorno, mese, anno
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

  // 2. Genera opzioni
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
  const months = [
    { value: "01", label: "Gennaio" },
    { value: "02", label: "Febbraio" },
    { value: "03", label: "Marzo" },
    { value: "04", label: "Aprile" },
    { value: "05", label: "Maggio" },
    { value: "06", label: "Giugno" },
    { value: "07", label: "Luglio" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Settembre" },
    { value: "10", label: "Ottobre" },
    { value: "11", label: "Novembre" },
    { value: "12", label: "Dicembre" },
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => String(currentYear - i));

  // 3. Aggiorna il valore del campo data_nascita quando cambiano le select
  useEffect(() => {
    if (birthDay && birthMonth && birthYear) {
      form.setValue("data_nascita", `${birthYear}-${birthMonth}-${birthDay}`);
    }
  }, [birthDay, birthMonth, birthYear]);
  
const { mutate, isPending } = useMutation({
  mutationFn: (formData: FormValues) => apiRequest('POST', '/api/auth/register', formData),
  onSuccess: () => {
    toast({
      title: "Registrazione Inviata",
      description: "La tua richiesta è in attesa di approvazione da parte di un amministratore.",
      variant: "success",
    });
    form.reset();
    // Qui, in futuro, potresti voler reindirizzare l'utente
    // ad una pagina di "attesa approvazione".
  },
  onError: (error) => {
    toast({
      title: "Errore di Registrazione",
      description: error instanceof Error ? error.message : "Si è verificato un errore durante la registrazione.",
      variant: "destructive",
    });
  }
});
  
  // Handle residence country change
  useEffect(() => {
    const paeseResidenza = form.watch("paese_residenza");
    if (paeseResidenza === "Italia") {
      const regioni = ITALY_DATA.Italia.regioni.map(regione => regione.nome);
      setRegioniResidenza(regioni);
    } else {
      setRegioniResidenza([]);
      form.setValue("regione_residenza", "");
    }
    setProvinceResidenza([]);
    setComuniResidenza([]);
    form.setValue("provincia_residenza", "");
    form.setValue("comune_residenza", "");
  }, [form.watch("paese_residenza")]);
  
  // Handle residence region change
  useEffect(() => {
    const paeseResidenza = form.watch("paese_residenza");
    const regioneResidenza = form.watch("regione_residenza");
    
    if (paeseResidenza === "Italia" && regioneResidenza) {
      const selectedRegion = ITALY_DATA.Italia.regioni.find(
        r => r.nome === regioneResidenza
      );
      
      if (selectedRegion) {
        const province = selectedRegion.province.map(provincia => provincia.nome);
        setProvinceResidenza(province);
      }
    } else {
      setProvinceResidenza([]);
    }
    setComuniResidenza([]);
    form.setValue("provincia_residenza", "");
    form.setValue("comune_residenza", "");
  }, [form.watch("regione_residenza")]);
  
  // Handle residence province change
  useEffect(() => {
    const paeseResidenza = form.watch("paese_residenza");
    const regioneResidenza = form.watch("regione_residenza");
    const provinciaResidenza = form.watch("provincia_residenza");
    
    if (paeseResidenza === "Italia" && regioneResidenza && provinciaResidenza) {
      const selectedRegion = ITALY_DATA.Italia.regioni.find(
        r => r.nome === regioneResidenza
      );
      
      if (selectedRegion) {
        const selectedProvince = selectedRegion.province.find(
          p => p.nome === provinciaResidenza
        );
        
        if (selectedProvince) {
          setComuniResidenza(selectedProvince.comuni);
        }
      }
    } else {
      setComuniResidenza([]);
    }
    form.setValue("comune_residenza", "");
  }, [form.watch("provincia_residenza")]);
  
  // Handle election country change
  useEffect(() => {
    const paeseElezione = form.watch("paese_elezione");
    if (paeseElezione === "Italia") {
      const regioni = ITALY_DATA.Italia.regioni.map(regione => regione.nome);
      setRegioniElezione(regioni);
    } else {
      setRegioniElezione([]);
      form.setValue("regione_elezione", "");
    }
    setProvinceElezione([]);
    setComuniElezione([]);
    form.setValue("provincia_elezione", "");
    form.setValue("comune_elezione", "");
  }, [form.watch("paese_elezione")]);
  
  // Handle election region change
  useEffect(() => {
    const paeseElezione = form.watch("paese_elezione");
    const regioneElezione = form.watch("regione_elezione");
    
    if (paeseElezione === "Italia" && regioneElezione) {
      const selectedRegion = ITALY_DATA.Italia.regioni.find(
        r => r.nome === regioneElezione
      );
      
      if (selectedRegion) {
        const province = selectedRegion.province.map(provincia => provincia.nome);
        setProvinceElezione(province);
      }
    } else {
      setProvinceElezione([]);
    }
    setComuniElezione([]);
    form.setValue("provincia_elezione", "");
    form.setValue("comune_elezione", "");
  }, [form.watch("regione_elezione")]);
  
  // Handle election province change
  useEffect(() => {
    const paeseElezione = form.watch("paese_elezione");
    const regioneElezione = form.watch("regione_elezione");
    const provinciaElezione = form.watch("provincia_elezione");
    
    if (paeseElezione === "Italia" && regioneElezione && provinciaElezione) {
      const selectedRegion = ITALY_DATA.Italia.regioni.find(
        r => r.nome === regioneElezione
      );
      
      if (selectedRegion) {
        const selectedProvince = selectedRegion.province.find(
          p => p.nome === provinciaElezione
        );
        
        if (selectedProvince) {
          setComuniElezione(selectedProvince.comuni);
        }
      }
    } else {
      setComuniElezione([]);
    }
    form.setValue("comune_elezione", "");
  }, [form.watch("provincia_elezione")]);
  
  // Handle candidacy country change
  useEffect(() => {
    const paeseCandidatura = form.watch("paese_candidatura");
    if (paeseCandidatura === "Italia") {
      const regioni = ITALY_DATA.Italia.regioni.map(regione => regione.nome);
      setRegioniCandidatura(regioni);
    } else {
      setRegioniCandidatura([]);
      form.setValue("regione_candidatura", "");
    }
    setProvinceCandidatura([]);
    setComuniCandidatura([]);
    form.setValue("provincia_candidatura", "");
    form.setValue("comune_candidatura", "");
  }, [form.watch("paese_candidatura")]);
  
  // Handle candidacy region change
  useEffect(() => {
    const paeseCandidatura = form.watch("paese_candidatura");
    const regioneCandidatura = form.watch("regione_candidatura");
    
    if (paeseCandidatura === "Italia" && regioneCandidatura) {
      const selectedRegion = ITALY_DATA.Italia.regioni.find(
        r => r.nome === regioneCandidatura
      );
      
      if (selectedRegion) {
        const province = selectedRegion.province.map(provincia => provincia.nome);
        setProvinceCandidatura(province);
      }
    } else {
      setProvinceCandidatura([]);
    }
    setComuniCandidatura([]);
    form.setValue("provincia_candidatura", "");
    form.setValue("comune_candidatura", "");
  }, [form.watch("regione_candidatura")]);
  
  // Handle candidacy province change
  useEffect(() => {
    const paeseCandidatura = form.watch("paese_candidatura");
    const regioneCandidatura = form.watch("regione_candidatura");
    const provinciaCandidatura = form.watch("provincia_candidatura");
    
    if (paeseCandidatura === "Italia" && regioneCandidatura && provinciaCandidatura) {
      const selectedRegion = ITALY_DATA.Italia.regioni.find(
        r => r.nome === regioneCandidatura
      );
      
      if (selectedRegion) {
        const selectedProvince = selectedRegion.province.find(
          p => p.nome === provinciaCandidatura
        );
        
        if (selectedProvince) {
          setComuniCandidatura(selectedProvince.comuni);
        }
      }
    } else {
      setComuniCandidatura([]);
    }
    form.setValue("comune_candidatura", "");
  }, [form.watch("provincia_candidatura")]);
  
     // Form submission handler
   const onSubmit = (values: FormValues) => {
     // Prepara i dati per l'invio
     const formData = {
       ...values,
       // Assicurati che il codice fiscale sia in maiuscolo
       codice_fiscale: values.codice_fiscale.toUpperCase(),
       // Assicurati che l'email sia presente
       email: values.email,
       // Assicurati che la password sia presente
       password: values.password
     };
     
     console.log('Dati form da inviare:', formData);
     mutate(formData);
   };
  
function onInvalid(errors: any) {
  console.error("Errori di validazione del form:", errors);
  toast({
    title: "Errore di Validazione",
    description: "Per favore, controlla tutti i campi obbligatori e correggi gli errori.",
    variant: "destructive"
  });
}

  return (
    <Form {...form}>
<form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
        {/* Personal Information Section */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Informazioni Personali</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Nome Field */}
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required-field">Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Inserisci il nome" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Cognome Field */}
            <FormField
              control={form.control}
              name="cognome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required-field">Cognome</FormLabel>
                  <FormControl>
                    <Input placeholder="Inserisci il cognome" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Codice Fiscale Field */}
            <FormField
              control={form.control}
              name="codice_fiscale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required-field">Codice Fiscale</FormLabel>
                  <FormControl>
                    <CodiceFiscaleInput
                      value={field.value}
                      onChange={field.onChange}
                      required={true}
                      placeholder="Inserisci il codice fiscale"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Email Field */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required-field">Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="Inserisci la tua email" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Data di Nascita Field (Picker rotella) */}
            <FormField
              control={form.control}
              name="data_nascita"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required-field">Data di Nascita</FormLabel>
                  <div className="max-w-full flex flex-col items-center">
                    <div className="w-full flex justify-center">
                      <div className="bg-white rounded-md border border-gray-200 p-2">
                        <Picker
                          value={{
                            day: birthDay || days[0],
                            month: birthMonth || months[0].value,
                            year: birthYear || years[0],
                          }}
                          onChange={(val: { day: string; month: string; year: string }) => {
                            setBirthDay(val.day);
                            setBirthMonth(val.month);
                            setBirthYear(val.year);
                          }}
                          height={120}
                          itemHeight={36}
                          wheelMode="natural"
                        >
                        <Picker.Column name="day">
                          {days.map((d) => (
                            <Picker.Item key={d} value={d}>{d}</Picker.Item>
                          ))}
                        </Picker.Column>
                        <Picker.Column name="month">
                          {months.map((m) => (
                            <Picker.Item key={m.value} value={m.value}>{m.label}</Picker.Item>
                          ))}
                        </Picker.Column>
                        <Picker.Column name="year">
                          {years.map((y) => (
                            <Picker.Item key={y} value={y}>{y}</Picker.Item>
                          ))}
                        </Picker.Column>
                      </Picker>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Genere Field */}
            <FormField
              control={form.control}
              name="genere"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required-field">Genere</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white">
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
            
            {/* Cittadinanza Field */}
            <FormField
              control={form.control}
              name="cittadinanza"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required-field">Cittadinanza</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Seleziona cittadinanza" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Italia">Italia</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        {/* Password Section */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Sicurezza Account</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Password Field */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required-field">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Inserisci la password"
                        autoComplete="new-password"
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
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12.001C3.226 16.273 7.355 19.5 12 19.5c1.658 0 3.237-.335 4.646-.94M21.065 11.999A10.45 10.45 0 0020.02 8.22M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
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
            {/* Confirm Password Field */}
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required-field">Conferma Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Conferma la password"
                        autoComplete="new-password"
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
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12.001C3.226 16.273 7.355 19.5 12 19.5c1.658 0 3.237-.335 4.646-.94M21.065 11.999A10.45 10.45 0 0020.02 8.22M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
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
        </div>
        
        {/* Residence Information Section */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Se sei un politico o un candidato, con Demos puoi:</h3>
          <ul className="list-disc list-inside text-gray-700 mb-4">
            <li>allargare il tuo bacino di elettori;</li>
            <li>scoprire le preferenze delle persone sugli argomenti importanti;</li>
            <li>monitorare le opinioni per zone, genere, fasce d'età, etc.</li>
            <li>tenere sempre aggiornati i tuoi sostenitori sui tuoi eventi, votazioni, etc.</li>
          </ul>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Paese di Residenza Field */}
            <FormField
              control={form.control}
              name="paese_residenza"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required-field">Paese di Residenza</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Seleziona paese" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Italia">Italia</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Regione di Residenza Field */}
            <FormField
              control={form.control}
              name="regione_residenza"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required-field">Regione di Residenza</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!form.watch("paese_residenza") || regioniResidenza.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className={`bg-white ${!form.watch("paese_residenza") ? "opacity-50" : ""}`}>
                        <SelectValue placeholder="Seleziona prima il paese" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {regioniResidenza.map(regione => (
                        <SelectItem key={regione} value={regione}>
                          {regione}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Provincia di Residenza Field */}
            <FormField
              control={form.control}
              name="provincia_residenza"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required-field">Provincia di Residenza</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!form.watch("regione_residenza") || provinceResidenza.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className={`bg-white ${!form.watch("regione_residenza") ? "opacity-50" : ""}`}>
                        <SelectValue placeholder="Seleziona prima la regione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {provinceResidenza.map(provincia => (
                        <SelectItem key={provincia} value={provincia}>
                          {provincia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Comune di Residenza Field */}
            <FormField
              control={form.control}
              name="comune_residenza"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required-field">Comune di Residenza</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!form.watch("provincia_residenza") || comuniResidenza.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className={`bg-white ${!form.watch("provincia_residenza") ? "opacity-50" : ""}`}>
                        <SelectValue placeholder="Seleziona prima la provincia" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {comuniResidenza.map(comune => (
                        <SelectItem key={comune} value={comune}>
                          {comune}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        {/* Election Information Section */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Informazioni di Elezione</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Paese di Elezione Field */}
            <FormField
              control={form.control}
              name="paese_elezione"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paese di Elezione</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Seleziona paese" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Italia">Italia</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Regione di Elezione Field */}
            <FormField
              control={form.control}
              name="regione_elezione"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Regione di Elezione</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!form.watch("paese_elezione") || regioniElezione.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className={`bg-white ${!form.watch("paese_elezione") ? "opacity-50" : ""}`}>
                        <SelectValue placeholder="Seleziona prima il paese" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {regioniElezione.map(regione => (
                        <SelectItem key={regione} value={regione}>
                          {regione}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Provincia di Elezione Field */}
            <FormField
              control={form.control}
              name="provincia_elezione"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provincia di Elezione</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!form.watch("regione_elezione") || provinceElezione.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className={`bg-white ${!form.watch("regione_elezione") ? "opacity-50" : ""}`}>
                        <SelectValue placeholder="Seleziona prima la regione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {provinceElezione.map(provincia => (
                        <SelectItem key={provincia} value={provincia}>
                          {provincia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Comune di Elezione Field */}
            <FormField
              control={form.control}
              name="comune_elezione"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comune di Elezione</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!form.watch("provincia_elezione") || comuniElezione.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className={`bg-white ${!form.watch("provincia_elezione") ? "opacity-50" : ""}`}>
                        <SelectValue placeholder="Seleziona prima la provincia" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {comuniElezione.map(comune => (
                        <SelectItem key={comune} value={comune}>
                          {comune}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        {/* Candidacy Information Section */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Informazioni di Candidatura</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Paese di Candidatura Field */}
            <FormField
              control={form.control}
              name="paese_candidatura"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paese di Candidatura</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Seleziona paese" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Italia">Italia</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Regione di Candidatura Field */}
            <FormField
              control={form.control}
              name="regione_candidatura"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Regione di Candidatura</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!form.watch("paese_candidatura") || regioniCandidatura.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className={`bg-white ${!form.watch("paese_candidatura") ? "opacity-50" : ""}`}>
                        <SelectValue placeholder="Seleziona prima il paese" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {regioniCandidatura.map(regione => (
                        <SelectItem key={regione} value={regione}>
                          {regione}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Provincia di Candidatura Field */}
            <FormField
              control={form.control}
              name="provincia_candidatura"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provincia di Candidatura</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!form.watch("regione_candidatura") || provinceCandidatura.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className={`bg-white ${!form.watch("regione_candidatura") ? "opacity-50" : ""}`}>
                        <SelectValue placeholder="Seleziona prima la regione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {provinceCandidatura.map(provincia => (
                        <SelectItem key={provincia} value={provincia}>
                          {provincia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Comune di Candidatura Field */}
            <FormField
              control={form.control}
              name="comune_candidatura"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comune di Candidatura</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!form.watch("provincia_candidatura") || comuniCandidatura.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className={`bg-white ${!form.watch("provincia_candidatura") ? "opacity-50" : ""}`}>
                        <SelectValue placeholder="Seleziona prima la provincia" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {comuniCandidatura.map(comune => (
                        <SelectItem key={comune} value={comune}>
                          {comune}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        {/* Role and Level Section */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Ruolo e Grado</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Ruolo Field */}
            <FormField
              control={form.control}
              name="ruolo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="required-field">Ruolo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Seleziona ruolo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="elettore">Elettore</SelectItem>
                      <SelectItem value="politico">Politico</SelectItem>
                      <SelectItem value="candidato">Candidato</SelectItem>
                      <SelectItem value="politico_candidato">Politico Candidato</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Grado Elezione Field */}
            <FormField
              control={form.control}
              name="grado_elezione"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grado Elezione</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Seleziona grado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="parlamento_europeo">Parlamento Europeo</SelectItem>
                      <SelectItem value="parlamento_italiano">Parlamento Italiano</SelectItem>
                      <SelectItem value="regione">Regione</SelectItem>
                      <SelectItem value="comune">Comune</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Grado Candidatura Field */}
            <FormField
              control={form.control}
              name="grado_candidatura"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grado Candidatura</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Seleziona grado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="parlamento_europeo">Parlamento Europeo</SelectItem>
                      <SelectItem value="parlamento_italiano">Parlamento Italiano</SelectItem>
                      <SelectItem value="regione">Regione</SelectItem>
                      <SelectItem value="comune">Comune</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        {/* Submit Button */}
        <div className="text-right">
          <p className="text-sm text-gray-500 mb-4">I campi contrassegnati con * sono obbligatori</p>
          <Button 
            type="submit"
            className="py-2 px-6 bg-primary hover:bg-blue-700 transition-colors duration-200"
            disabled={isPending}
          >
            {isPending ? (
              <>
                Invio in corso
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              </>
            ) : (
              "Invia"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
