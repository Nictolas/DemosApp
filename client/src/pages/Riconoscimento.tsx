import React, { useEffect, useState } from "react";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/api-config";
import { ITALY_DATA } from "@/data/italyData";

type RuoloRichiesto = "P" | "C" | "CP" | "";

interface FormState {
  tipo_ruolo: RuoloRichiesto;
  nome: string;
  cognome: string;
  email: string;
  fonte_elezione_url: string;
  fonte_candidatura_url: string;
  // Paesi salvati come codici (it, sm, ch, ...)
  paese_elezione: string;
  regione_elezione: string;
  provincia_elezione: string;
  comune_elezione: string;
  grado_elezione: string;
  paese_candidatura: string;
  regione_candidatura: string;
  provincia_candidatura: string;
  comune_candidatura: string;
  grado_candidatura: string;
}

const initialState: FormState = {
  tipo_ruolo: "",
  nome: "",
  cognome: "",
  email: "",
  fonte_elezione_url: "",
  fonte_candidatura_url: "",
  paese_elezione: "",       // scelto esplicitamente dall'utente
  regione_elezione: "",
  provincia_elezione: "",
  comune_elezione: "",
  grado_elezione: "",
  paese_candidatura: "",    // scelto esplicitamente dall'utente
  regione_candidatura: "",
  provincia_candidatura: "",
  comune_candidatura: "",
  grado_candidatura: ""
};

// Mappatura codici paese ↔ label ↔ chiave nei dati geografici
const PAESE_OPTIONS = [
  { code: "it", label: "Italia", dataKey: "Italia" as const },
  { code: "sm", label: "San Marino", dataKey: "San Marino" as const },
  { code: "ch", label: "Svizzera", dataKey: "Svizzera" as const },
  { code: "xx", label: "Estero", dataKey: null as null },
];

const getPaeseDataKey = (code: string) => {
  const found = PAESE_OPTIONS.find((p) => p.code === code);
  return found?.dataKey || null;
};

const getRegioniByPaese = (paeseCode: string): string[] => {
  const dataKey = getPaeseDataKey(paeseCode);
  if (!dataKey) return [];
  const country = (ITALY_DATA as any)[dataKey];
  if (!country) return [];
  return country.regioni.map((r: any) => r.nome);
};

const getProvince = (paeseCode: string, regione: string): string[] => {
  if (!paeseCode || !regione || regione === "Estero") return [];

  const dataKey = getPaeseDataKey(paeseCode);
  if (!dataKey) return [];

  const country = (ITALY_DATA as any)[dataKey];
  if (!country) return [];

  const regioneSelezionata = country.regioni.find((r: any) => r.nome === regione);
  return regioneSelezionata ? regioneSelezionata.province.map((p: any) => p.nome) : [];
};

const getComuni = (paeseCode: string, regione: string, provincia: string): string[] => {
  if (!paeseCode || !regione || !provincia || regione === "Estero") return [];

  const dataKey = getPaeseDataKey(paeseCode);
  if (!dataKey) return [];

  const country = (ITALY_DATA as any)[dataKey];
  if (!country) return [];

  const regioneSelezionata = country.regioni.find((r: any) => r.nome === regione);
  const provinciaSelezionata = regioneSelezionata?.province.find((p: any) => p.nome === provincia);

  if (!provinciaSelezionata) return [];

  // Nei dati, i comuni per l'Italia sono array di stringhe, per San Marino / Svizzera possono già essere stringhe
  return provinciaSelezionata.comuni.map((c: any) => (typeof c === "string" ? c : c.nome));
};

export default function Riconoscimento() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>({
    ...initialState,
    nome: user?.nome || "",
    cognome: user?.cognome || "",
    email: user?.email || ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [identity, setIdentity] = useState<"loading" | "verified" | "unverified" | "error">("loading");
  const [isStartingCie, setIsStartingCie] = useState(false);
  const [requestStatus, setRequestStatus] = useState<null | {
    tipo_ruolo: string; status: "pending" | "approved" | "rejected"; created_at: string;
  }>(null);

  useEffect(() => {
    setForm(prev => ({
      ...prev, nome: user?.nome || "", cognome: user?.cognome || "", email: user?.email || ""
    }));
  }, [user?.nome, user?.cognome, user?.email]);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) { setIdentity("unverified"); return; }
    let active = true;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(getApiUrl("/auth/identity/status"), { headers }).then(async res => {
        if (!res.ok) throw new Error("Stato CIE non disponibile");
        return res.json();
      }),
      fetch(getApiUrl("/riconoscimenti/mine"), { headers }).then(async res => {
        if (!res.ok) throw new Error("Stato richiesta non disponibile");
        return res.json();
      })
    ]).then(([verification, recognition]) => {
      if (!active) return;
      setIdentity(verification?.identity?.verified === true &&
        String(verification.identity?.provider || "").toUpperCase() === "CIE"
        ? "verified" : "unverified");
      setRequestStatus(recognition?.data || null);
    }).catch(() => { if (active) setIdentity("error"); });
    return () => { active = false; };
  }, []);

  const handleStartCie = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      toast({ title: "Accesso richiesto", description: "Accedi a DEMOS prima di verificare la CIE.", variant: "destructive" });
      return;
    }
    setIsStartingCie(true);
    try {
      const res = await fetch(getApiUrl("/auth/identity/cie/start"), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await res.json();
      if (!res.ok || typeof payload?.authorizationUrl !== "string") {
        throw new Error(payload?.error || "Verifica CIE non disponibile");
      }
      const authorizationUrl = new URL(payload.authorizationUrl);
      if (authorizationUrl.protocol !== "https:") throw new Error("Indirizzo CIE non sicuro");
      window.location.assign(authorizationUrl.toString());
    } catch (error: any) {
      toast({ title: "Impossibile avviare CIE", description: error?.message || "Riprova più tardi.", variant: "destructive" });
      setIsStartingCie(false);
    }
  };

  const regioniElezione = getRegioniByPaese(form.paese_elezione);
  const provinceElezione = getProvince(form.paese_elezione, form.regione_elezione);
  const comuniElezione = getComuni(
    form.paese_elezione,
    form.regione_elezione,
    form.provincia_elezione
  );

  const regioniCandidatura = getRegioniByPaese(form.paese_candidatura);
  const provinceCandidatura = getProvince(
    form.paese_candidatura,
    form.regione_candidatura
  );
  const comuniCandidatura = getComuni(
    form.paese_candidatura,
    form.regione_candidatura,
    form.provincia_candidatura
  );

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleChangePaeseElezione = (value: string) => {
    setForm((prev) => ({
      ...prev,
      paese_elezione: value,
      regione_elezione: "",
      provincia_elezione: "",
      comune_elezione: ""
    }));
  };

  const handleChangeRegioneElezione = (value: string) => {
    setForm((prev) => ({
      ...prev,
      regione_elezione: value,
      provincia_elezione: "",
      comune_elezione: ""
    }));
  };

  const handleChangeProvinciaElezione = (value: string) => {
    setForm((prev) => ({
      ...prev,
      provincia_elezione: value,
      comune_elezione: ""
    }));
  };

  const handleChangePaeseCandidatura = (value: string) => {
    setForm((prev) => ({
      ...prev,
      paese_candidatura: value,
      regione_candidatura: "",
      provincia_candidatura: "",
      comune_candidatura: ""
    }));
  };

  const handleChangeRegioneCandidatura = (value: string) => {
    setForm((prev) => ({
      ...prev,
      regione_candidatura: value,
      provincia_candidatura: "",
      comune_candidatura: ""
    }));
  };

  const handleChangeProvinciaCandidatura = (value: string) => {
    setForm((prev) => ({
      ...prev,
      provincia_candidatura: value,
      comune_candidatura: ""
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.tipo_ruolo) {
      toast({
        title: "Seleziona il ruolo",
        description: "Scegli se sei Politico, Candidato o Candidato Politico.",
        variant: "destructive"
      });
      return;
    }

    if (!form.nome || !form.cognome || !form.email) {
      toast({
        title: "Campi obbligatori mancanti",
        description: "Nome, cognome ed email sono obbligatori.",
        variant: "destructive"
      });
      return;
    }

    // Validazioni minime coerenti con il backend
    if ((form.tipo_ruolo === "P" || form.tipo_ruolo === "CP") && !form.grado_elezione) {
      toast({
        title: "Dati di elezione mancanti",
        description: "Per Politico o Candidato Politico inserisci almeno il grado di elezione.",
        variant: "destructive"
      });
      return;
    }

    if ((form.tipo_ruolo === "C" || form.tipo_ruolo === "CP") && !form.grado_candidatura) {
      toast({
        title: "Dati di candidatura mancanti",
        description: "Per Candidato o Candidato Politico inserisci almeno il grado di candidatura.",
        variant: "destructive"
      });
      return;
    }

    const token = localStorage.getItem("auth_token");
    if (!token) {
      toast({
        title: "Autenticazione richiesta",
        description: "Effettua il login per inviare una richiesta di riconoscimento.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(getApiUrl("/riconoscimenti"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.message || errorBody?.error || "Impossibile inviare la richiesta di riconoscimento.");
      }

      toast({
        title: "Richiesta inviata",
        description: "La tua richiesta di riconoscimento è stata inviata agli amministratori.",
        variant: "default"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error?.message || "Errore durante l'invio della richiesta.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const mostraElezione = form.tipo_ruolo === "P" || form.tipo_ruolo === "CP";
  const mostraCandidatura = form.tipo_ruolo === "C" || form.tipo_ruolo === "CP";

  return (
    <PageContainer className="bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <div className="w-full h-full flex items-start justify-center pt-6 pb-24 px-4">
        <Card className="w-full max-w-2xl shadow-xl border-0">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              Riconoscimento - Sono un politico / candidato
            </CardTitle>
            <CardDescription>
              Invia una richiesta di riconoscimento del tuo ruolo. Un amministratore verificherà i dati e, se approvata, il tuo ruolo sarà aggiornato in Demos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Ruolo richiesto
              </label>
              <Select
                value={form.tipo_ruolo}
                onValueChange={value => handleChange("tipo_ruolo", value as RuoloRichiesto)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona il ruolo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="P">Politico</SelectItem>
                  <SelectItem value="C">Candidato</SelectItem>
                  <SelectItem value="CP">Candidato Politico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Nome</label>
                <Input
                  value={form.nome}
                  onChange={e => handleChange("nome", e.target.value)}
                  placeholder="Nome"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Cognome</label>
                <Input
                  value={form.cognome}
                  onChange={e => handleChange("cognome", e.target.value)}
                  placeholder="Cognome"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={e => handleChange("email", e.target.value)}
                placeholder="la-tua-email@example.com"
                required
              />
            </div>

            {mostraElezione && (
              <div className="space-y-3 border rounded-xl p-4 bg-blue-50/60">
                <div className="text-sm font-semibold text-blue-800">
                  Dati di elezione (se sei già stato eletto)
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Grado elezione</label>
                  <Select
                    value={form.grado_elezione}
                    onValueChange={(value) => handleChange("grado_elezione", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona il grado di elezione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CO">Comune</SelectItem>
                      <SelectItem value="P">Provincia</SelectItem>
                      <SelectItem value="R">Regione</SelectItem>
                      <SelectItem value="C">Camera dei deputati</SelectItem>
                      <SelectItem value="S">Senato</SelectItem>
                      <SelectItem value="E">Parlamento europeo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Paese elezione</label>
                    <Select
                      value={form.paese_elezione}
                      onValueChange={handleChangePaeseElezione}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona paese" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAESE_OPTIONS.map((p) => (
                          <SelectItem key={p.code} value={p.code}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.paese_elezione && form.paese_elezione !== "xx" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Regione elezione</label>
                      <Select
                        value={form.regione_elezione}
                        onValueChange={handleChangeRegioneElezione}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona regione" />
                        </SelectTrigger>
                        <SelectContent>
                          {regioniElezione.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                          <SelectItem value="Estero">Estero</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {form.paese_elezione &&
                    form.paese_elezione !== "xx" &&
                    form.regione_elezione &&
                    form.regione_elezione !== "Estero" && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Provincia elezione</label>
                        <Select
                          value={form.provincia_elezione}
                          onValueChange={handleChangeProvinciaElezione}
                          disabled={!provinceElezione.length}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona provincia" />
                          </SelectTrigger>
                          <SelectContent>
                            {provinceElezione.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                  {form.paese_elezione &&
                    form.paese_elezione !== "xx" &&
                    form.regione_elezione &&
                    form.regione_elezione !== "Estero" &&
                    form.provincia_elezione && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Comune elezione</label>
                        <Select
                          value={form.comune_elezione}
                          onValueChange={(value) => handleChange("comune_elezione", value)}
                          disabled={!comuniElezione.length}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona comune" />
                          </SelectTrigger>
                          <SelectContent>
                            {comuniElezione.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                </div>
              </div>
            )}

            {mostraCandidatura && (
              <div className="space-y-3 border rounded-xl p-4 bg-emerald-50/60">
                <div className="text-sm font-semibold text-emerald-800">
                  Dati di candidatura (se sei candidato)
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Grado candidatura</label>
                  <Select
                    value={form.grado_candidatura}
                    onValueChange={(value) => handleChange("grado_candidatura", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona il grado di candidatura" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CO">Comune</SelectItem>
                      <SelectItem value="P">Provincia</SelectItem>
                      <SelectItem value="R">Regione</SelectItem>
                      <SelectItem value="C">Camera dei deputati</SelectItem>
                      <SelectItem value="S">Senato</SelectItem>
                      <SelectItem value="E">Parlamento europeo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Paese candidatura</label>
                    <Select
                      value={form.paese_candidatura}
                      onValueChange={handleChangePaeseCandidatura}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona paese" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAESE_OPTIONS.map((p) => (
                          <SelectItem key={p.code} value={p.code}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.paese_candidatura && form.paese_candidatura !== "xx" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Regione candidatura</label>
                      <Select
                        value={form.regione_candidatura}
                        onValueChange={handleChangeRegioneCandidatura}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona regione" />
                        </SelectTrigger>
                        <SelectContent>
                          {regioniCandidatura.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                          <SelectItem value="Estero">Estero</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {form.paese_candidatura &&
                    form.paese_candidatura !== "xx" &&
                    form.regione_candidatura &&
                    form.regione_candidatura !== "Estero" && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Provincia candidatura
                        </label>
                        <Select
                          value={form.provincia_candidatura}
                          onValueChange={handleChangeProvinciaCandidatura}
                          disabled={!provinceCandidatura.length}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona provincia" />
                          </SelectTrigger>
                          <SelectContent>
                            {provinceCandidatura.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                  {form.paese_candidatura &&
                    form.paese_candidatura !== "xx" &&
                    form.regione_candidatura &&
                    form.regione_candidatura !== "Estero" &&
                    form.provincia_candidatura && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Comune candidatura</label>
                        <Select
                          value={form.comune_candidatura}
                          onValueChange={(value) => handleChange("comune_candidatura", value)}
                          disabled={!comuniCandidatura.length}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona comune" />
                          </SelectTrigger>
                          <SelectContent>
                            {comuniCandidatura.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                </div>
              </div>
            )}

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  className="min-w-[180px]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Invio in corso..." : "Invia richiesta"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

