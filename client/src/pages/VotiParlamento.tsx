import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { PageContainer } from "@/components/PageContainer";
import { Loader2, ArrowLeft, Vote, AlertCircle, RefreshCw, Calendar, Building2, Sparkles, Users, CheckCircle2, XCircle, MinusCircle, User, Info, Eye, TrendingUp, TrendingDown, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface VotazioneParlamento {
  votazione_id: number;
  titolo_votazione: string;
  descrizione_votazione: string | null;
  descrizione?: string | null;
  camera: string;
  data_votazione: string | null;
  spiegazione: string | null;
  esito: string | null;
  legislatura: number | null;
  tipo_atto: string | null;
  sigla_atto: string | null;
  numero_atto: number | null;
  // Dati tecnici Senato
  favorevoli: number | null;
  contrari: number | null;
  presenti: number | null;
  votanti: number | null;
  maggioranza: number | null;
  astenuti: number | null;
  numero_legale: number | null;
  presidente: string | null;
  tipo_seduta: string | null;
  numero_seduta: string | null;
  titolo_seduta: string | null;
  // Dati Camera
  approvato: number | null;
  // Flag
  dati_arricchiti?: boolean;
  // URI per dettagli (o link Openpolis se source === 'openpolis')
  uri?: string;
  url_votazione?: string | null;
  source?: string;
}

interface VotazioniParlamentoResponse {
  camera: VotazioneParlamento[];
  senato: VotazioneParlamento[];
  combined: { camera: VotazioneParlamento[]; senato: VotazioneParlamento[] };
}

interface AnalisiLegge {
  spiegazione_generale?: string | null;
  effetti_positivi?: string | null;
  effetti_negativi?: string | null;
  numero_legge?: string | null;
  tipo_atto?: string | null;
  provider_ai?: string | null;
  modello_ai?: string | null;
  data_generazione?: string | null;
}

interface DettagliVotazione extends VotazioneParlamento {
  titolo?: string | null;
  tipo_votazione?: string | null;
  voti_nominali?: {
    favorevoli: string[];
    contrari: string[];
    astenuti: string[];
  } | null;
  uri_seduta?: string | null;
  analisi_legge?: AnalisiLegge | null;
}

// Funzione helper per verificare se una data è un riferimento a una legge/decreto (non una scadenza)
function isRiferimentoLegge(testoPrimaData: string): boolean {
  const testoLower = testoPrimaData.toLowerCase();
  // Parole che indicano un riferimento normativo (non una scadenza)
  const riferimentiNormativi = [
    'legge', 'decreto', 'dl', 'ddl', 'd.l.', 'd.d.l.', 'decreto-legge',
    'decreto legge', 'legge n.', 'legge numero', 'd.lgs.', 'd.p.r.',
    'del decreto', 'della legge', 'dell\'articolo', 'dell\'art.',
    'articolo', 'art.', 'comma', 'alinea', 'lettera'
  ];
  
  // Controlla se nel testo prima della data c'è un riferimento normativo
  return riferimentiNormativi.some(rif => {
    // Cerca la parola seguita eventualmente da "n.", "numero", o direttamente dalla data
    const pattern = new RegExp(`\\b${rif}\\s*(?:n\\.?|numero|del|della|dell')?\\s*$`, 'i');
    return pattern.test(testoPrimaData);
  });
}

// Funzione helper per rilevare date nel testo e verificare se sono passate (solo scadenze, non riferimenti a leggi)
function rilevaScadenzePassate(testo: string): Array<{ data: string; testo: string; passata: boolean }> {
  const scadenze: Array<{ data: string; testo: string; passata: boolean }> = [];
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  
  // Pattern per date: "27 novembre 2025", "31/12/2025", "2025-12-31", "entro il 27 novembre 2025"
  const patternDate = /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/gi;
  const patternDateSlash = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  const patternDateISO = /(\d{4})-(\d{1,2})-(\d{1,2})/g;
  
  const mesi: { [key: string]: number } = {
    'gennaio': 1, 'febbraio': 2, 'marzo': 3, 'aprile': 4, 'maggio': 5, 'giugno': 6,
    'luglio': 7, 'agosto': 8, 'settembre': 9, 'ottobre': 10, 'novembre': 11, 'dicembre': 12
  };
  
  // Cerca date nel formato "27 novembre 2025"
  let match;
  while ((match = patternDate.exec(testo)) !== null) {
    const giorno = parseInt(match[1]);
    const mese = mesi[match[2].toLowerCase()];
    const anno = parseInt(match[3]);
    const data = new Date(anno, mese - 1, giorno);
    data.setHours(0, 0, 0, 0);
    
    const inizioMatch = Math.max(0, match.index - 100);
    const testoPrimaData = testo.substring(inizioMatch, match.index);
    
    // Se è un riferimento a una legge/decreto, salta questa data
    if (isRiferimentoLegge(testoPrimaData)) {
      continue;
    }
    
    const fineMatch = Math.min(testo.length, match.index + match[0].length + 50);
    const contesto = testo.substring(inizioMatch, fineMatch);
    
    if (data < oggi) {
      scadenze.push({
        data: match[0],
        testo: contesto,
        passata: true
      });
    }
  }
  
  // Cerca date nel formato "31/12/2025"
  while ((match = patternDateSlash.exec(testo)) !== null) {
    const giorno = parseInt(match[1]);
    const mese = parseInt(match[2]);
    const anno = parseInt(match[3]);
    const data = new Date(anno, mese - 1, giorno);
    data.setHours(0, 0, 0, 0);
    
    const inizioMatch = Math.max(0, match.index - 100);
    const testoPrimaData = testo.substring(inizioMatch, match.index);
    
    // Se è un riferimento a una legge/decreto, salta questa data
    if (isRiferimentoLegge(testoPrimaData)) {
      continue;
    }
    
    const fineMatch = Math.min(testo.length, match.index + match[0].length + 50);
    const contesto = testo.substring(inizioMatch, fineMatch);
    
    if (data < oggi) {
      scadenze.push({
        data: match[0],
        testo: contesto,
        passata: true
      });
    }
  }
  
  // Cerca date nel formato ISO "2025-12-31"
  while ((match = patternDateISO.exec(testo)) !== null) {
    const anno = parseInt(match[1]);
    const mese = parseInt(match[2]);
    const giorno = parseInt(match[3]);
    const data = new Date(anno, mese - 1, giorno);
    data.setHours(0, 0, 0, 0);
    
    const inizioMatch = Math.max(0, match.index - 100);
    const testoPrimaData = testo.substring(inizioMatch, match.index);
    
    // Se è un riferimento a una legge/decreto, salta questa data
    if (isRiferimentoLegge(testoPrimaData)) {
      continue;
    }
    
    const fineMatch = Math.min(testo.length, match.index + match[0].length + 50);
    const contesto = testo.substring(inizioMatch, fineMatch);
    
    if (data < oggi) {
      scadenze.push({
        data: match[0],
        testo: contesto,
        passata: true
      });
    }
  }
  
  return scadenze;
}

// Funzione per evidenziare scadenze passate nel testo
function evidenziaScadenzePassate(testo: string): string {
  const scadenze = rilevaScadenzePassate(testo);
  let testoEvidenziato = testo;
  
  scadenze.forEach((scadenza) => {
    if (scadenza.passata) {
      // Evidenzia la data passata con un badge
      const regex = new RegExp(`(${scadenza.data.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      testoEvidenziato = testoEvidenziato.replace(regex, (match) => {
        return `${match} ⚠️ (scadenza passata)`;
      });
    }
  });
  
  return testoEvidenziato;
}

// Funzione helper per formattare il titolo in modo compatto
function formattaTitoloCompatto(titolo: string): string {
  if (!titolo) return titolo;
  
  // Pattern per "Disegno di legge n. XXXX"
  const patternDDL = /disegno\s+di\s+legge\s+n\.?\s*(\d+)/i;
  const matchDDL = titolo.match(patternDDL);
  
  if (matchDDL) {
    const numero = matchDDL[1];
    // Rimuovi tutto dopo il numero (es: ". Votazione questione fiducia")
    return `DDL ${numero}`;
  }
  
  // Pattern per "DDL XXXX" (già formato)
  const patternDDLGià = /^DDL\s+(\d+)/i;
  if (titolo.match(patternDDLGià)) {
    return titolo.match(patternDDLGià)?.[0] || titolo;
  }
  
  // Pattern per "Decreto-legge n. XXXX" o "DL n. XXXX"
  const patternDL = /(?:decreto\s*[-]?\s*legge|DL|D\.L\.)\s+n\.?\s*(\d+)/i;
  const matchDL = titolo.match(patternDL);
  if (matchDL) {
    const numero = matchDL[1];
    return `DL ${numero}`;
  }
  
  // Pattern per "Mozione n. XXXX"
  const patternMozione = /mozione\s+n\.?\s*(\d+)/i;
  const matchMozione = titolo.match(patternMozione);
  if (matchMozione) {
    const numero = matchMozione[1];
    return `Mozione ${numero}`;
  }
  
  // Se non trova pattern, ritorna il titolo originale
  return titolo;
}

export default function VotiParlamento() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [limit] = useState(3);
  const [selectedVotazione, setSelectedVotazione] = useState<VotazioneParlamento | null>(null);
  const [dettagliVotazione, setDettagliVotazione] = useState<DettagliVotazione | null>(null);
  const [loadingDettagli, setLoadingDettagli] = useState(false);

  // Query per recuperare le ultime votazioni
  const { data, isLoading, error, refetch } = useQuery<VotazioniParlamentoResponse>({
    queryKey: ["/api/voti-politici/ultime", limit],
    queryFn: async () => {
      // Forza refresh per ottenere dati aggiornati da SPARQL
      const response = await apiRequest("GET", `/api/voti-politici/ultime?limit=${limit}&refresh=true`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore nel recupero dei dati");
      }
      const result = await response.json();
      // La risposta ha: { camera, senato, combined: { camera, senato } }
      return {
        camera: result.camera || result.data?.camera || [],
        senato: result.senato || result.data?.senato || [],
        combined: result.combined || result.data?.combined || { camera: [], senato: [] }
      };
    },
    retry: 2,
    staleTime: 0, // Sempre considera i dati come "stale" per forzare refresh
    gcTime: 0, // Non cache i dati
  });

  const votazioniCamera: VotazioneParlamento[] = data?.camera || [];
  const votazioniSenato: VotazioneParlamento[] = data?.senato || [];
  const combinedCamera: VotazioneParlamento[] = data?.combined?.camera || [];
  const combinedSenato: VotazioneParlamento[] = data?.combined?.senato || [];

  // Per le due sotto-colonne: più recente da SPARQL e più recente da Openpolis
  const senatoSparql = votazioniSenato.find((v) => (v as { source?: string }).source !== "openpolis");
  const senatoOpenpolis = votazioniSenato.find((v) => (v as { source?: string }).source === "openpolis");
  const cameraSparql = votazioniCamera.find((v) => (v as { source?: string }).source !== "openpolis");
  const cameraOpenpolis = votazioniCamera.find((v) => (v as { source?: string }).source === "openpolis");

  const getCameraColor = (camera: string) => {
    if (camera === "Senato") return "bg-purple-100 text-purple-800 border-purple-300";
    return "bg-blue-100 text-blue-800 border-blue-300";
  };

  const getEsitoColor = (esito: string | null) => {
    if (!esito) return "bg-gray-100 text-gray-800 border-gray-300";
    const esitoLower = esito.toLowerCase();
    if (esitoLower.includes("approvato") || esitoLower.includes("favorevole")) {
      return "bg-green-100 text-green-800 border-green-300";
    }
    if (esitoLower.includes("non approvato") || esitoLower.includes("contrario")) {
      return "bg-red-100 text-red-800 border-red-300";
    }
    return "bg-yellow-100 text-yellow-800 border-yellow-300";
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Data non disponibile";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Votazioni da Openpolis (ultimi DDL approvati): mostra dialog con dati card + link a Openpolis
  const isOpenpolisVotazione = (v: VotazioneParlamento) =>
    (v as { source?: string }).source === "openpolis" ||
    (v.uri && String(v.uri).startsWith("https://parlamento19.openpolis.it"));

  // Funzione per caricare i dettagli di una votazione
  const handleVotazioneClick = async (votazione: VotazioneParlamento, forceRegenerate = false) => {
    if (isOpenpolisVotazione(votazione)) {
      setSelectedVotazione(votazione);
      setLoadingDettagli(false);
      setDettagliVotazione({
        ...votazione,
        titolo: votazione.titolo_votazione ?? votazione.descrizione_votazione ?? votazione.descrizione ?? "Votazione",
        descrizione: votazione.descrizione_votazione ?? votazione.descrizione ?? null,
      } as DettagliVotazione);
      return;
    }

    console.log('🔍 Click su votazione:', votazione);
    if (!votazione.uri) {
      toast({
        title: "Errore",
        description: "URI della votazione non disponibile",
        variant: "destructive",
      });
      return;
    }

    if (!forceRegenerate) {
      setSelectedVotazione(votazione);
    }
    setLoadingDettagli(true);

    try {
      const encodedUri = encodeURIComponent(votazione.uri);
      const url = forceRegenerate 
        ? `/api/voti-politici/dettagli/${encodedUri}?force=true`
        : `/api/voti-politici/dettagli/${encodedUri}`;
      
      const response = await apiRequest("GET", url);
      
      if (!response.ok) {
        throw new Error("Errore nel recupero dei dettagli");
      }

      const result = await response.json();
      setDettagliVotazione(result.data);
      
      if (forceRegenerate) {
        toast({
          title: "Analisi rigenerata",
          description: "L'analisi della legge è stata rigenerata con successo",
        });
      }
    } catch (error) {
      console.error("Errore nel caricamento dettagli:", error);
      toast({
        title: "Errore",
        description: forceRegenerate 
          ? "Impossibile rigenerare l'analisi della legge"
          : "Impossibile caricare i dettagli della votazione",
        variant: "destructive",
      });
      // Mostra comunque i dettagli base dalla card
      if (!forceRegenerate) {
        setDettagliVotazione(votazione as DettagliVotazione);
      }
    } finally {
      setLoadingDettagli(false);
    }
  };

  const handleRigeneraAnalisi = async () => {
    if (!selectedVotazione) return;
    await handleVotazioneClick(selectedVotazione, true);
  };

  return (
    <PageContainer className="bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setLocation("/gestisci")}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Vote className="h-8 w-8 text-green-600" />
                Voti Parlamento
              </h1>
              <p className="text-muted-foreground mt-1">
                Ultime {limit} votazioni della Camera e ultime {limit} votazioni del Senato
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Aggiorna
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Errore nel caricamento dei dati. Riprova più tardi.
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
              <p className="ml-4 text-muted-foreground">
                Caricamento votazioni...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Votazioni List */}
        {!isLoading && !error && (
          <>
            {votazioniCamera.length === 0 && votazioniSenato.length === 0 && combinedCamera.length === 0 && combinedSenato.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    Nessuna votazione trovata. Le votazioni verranno aggiornate automaticamente.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Due colonne: Senato (sinistra) | Camera (destra) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Colonna sinistra: Senato (2 sotto-colonne: SPARQL | Openpolis) */}
                  <div>
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <Building2 className="h-6 w-6 text-purple-600" />
                      Senato della Repubblica
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Votazione più recente (SPARQL)</h3>
                        {senatoSparql ? (
                          <Card className="transition-all hover:shadow-lg border-2 border-purple-200">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">
                                {formattaTitoloCompatto(senatoSparql.titolo_votazione || senatoSparql.descrizione || "Votazione")}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2 flex-wrap text-xs">
                                <Calendar className="h-3 w-3" />
                                {formatDate(senatoSparql.data_votazione)}
                                {senatoSparql.esito && (
                                  <Badge variant="outline" className={getEsitoColor(senatoSparql.esito)}>{senatoSparql.esito}</Badge>
                                )}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-2">
                              {senatoSparql.descrizione && <p className="text-xs text-gray-600 line-clamp-3">{senatoSparql.descrizione}</p>}
                              <Button onClick={() => handleVotazioneClick(senatoSparql)} variant="outline" size="sm" className="w-full">
                                <Eye className="h-3 w-3 mr-1" /> Dettagli
                              </Button>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card className="border-dashed"><CardContent className="py-6 text-center text-sm text-muted-foreground">Nessuna da SPARQL</CardContent></Card>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Votazione più recente (Openpolis)</h3>
                        {senatoOpenpolis ? (
                          <Card className="transition-all hover:shadow-lg border-2 border-amber-200">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">
                                {formattaTitoloCompatto(senatoOpenpolis.titolo_votazione || senatoOpenpolis.descrizione || "Votazione")}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2 flex-wrap text-xs">
                                <Calendar className="h-3 w-3" />
                                {formatDate(senatoOpenpolis.data_votazione)}
                                {senatoOpenpolis.esito && (
                                  <Badge variant="outline" className={getEsitoColor(senatoOpenpolis.esito)}>{senatoOpenpolis.esito}</Badge>
                                )}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-2">
                              {(senatoOpenpolis.descrizione || senatoOpenpolis.descrizione_votazione) && (
                                <p className="text-xs text-gray-600 line-clamp-3">{senatoOpenpolis.descrizione || senatoOpenpolis.descrizione_votazione}</p>
                              )}
                              <Button onClick={() => handleVotazioneClick(senatoOpenpolis)} variant="outline" size="sm" className="w-full">
                                <Eye className="h-3 w-3 mr-1" /> Dettagli
                              </Button>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card className="border-dashed"><CardContent className="py-6 text-center text-sm text-muted-foreground">Nessuna da Openpolis</CardContent></Card>
                        )}
                      </div>
                    </div>
                    {/* Terza card: Combinato (sempre visibile) */}
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2">Combinato</h3>
                      {combinedSenato[0] ? (
                        <Card className="transition-all hover:shadow-lg border-2 border-amber-400">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">
                              {formattaTitoloCompatto(combinedSenato[0].titolo_votazione || combinedSenato[0].descrizione || "Votazione")}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 flex-wrap text-xs">
                              <Calendar className="h-3 w-3" />
                              {formatDate(combinedSenato[0].data_votazione)}
                              {combinedSenato[0].esito && (
                                <Badge variant="outline" className={getEsitoColor(combinedSenato[0].esito)}>{combinedSenato[0].esito}</Badge>
                              )}
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300">SPARQL + Openpolis</Badge>
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-2">
                            {(combinedSenato[0].descrizione || combinedSenato[0].descrizione_votazione) && (
                              <p className="text-xs text-gray-600 line-clamp-3">{combinedSenato[0].descrizione || combinedSenato[0].descrizione_votazione}</p>
                            )}
                            <Button onClick={() => handleVotazioneClick(combinedSenato[0])} variant="outline" size="sm" className="w-full">
                              <Eye className="h-3 w-3 mr-1" /> Dettagli
                            </Button>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="border-amber-200 border-dashed">
                          <CardContent className="py-6 text-center text-sm text-muted-foreground">
                            Non siamo riusciti a combinare i dati per il Senato (nessun abbinamento per data e camera tra SPARQL e Openpolis).
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>

                  {/* Colonna destra: Camera (2 sotto-colonne: SPARQL | Openpolis) */}
                  <div>
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <Building2 className="h-6 w-6 text-blue-600" />
                      Camera dei Deputati
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Votazione più recente (SPARQL)</h3>
                        {cameraSparql ? (
                          <Card className="transition-all hover:shadow-lg border-2 border-blue-200">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">
                                {formattaTitoloCompatto(cameraSparql.titolo_votazione || cameraSparql.descrizione_votazione || "Votazione")}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2 flex-wrap text-xs">
                                <Calendar className="h-3 w-3" />
                                {formatDate(cameraSparql.data_votazione)}
                                {cameraSparql.esito && (
                                  <Badge variant="outline" className={getEsitoColor(cameraSparql.esito)}>{cameraSparql.esito}</Badge>
                                )}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-2">
                              {(cameraSparql.descrizione_votazione || cameraSparql.descrizione) && (
                                <p className="text-xs text-gray-600 line-clamp-3">{cameraSparql.descrizione_votazione || cameraSparql.descrizione}</p>
                              )}
                              <Button onClick={() => handleVotazioneClick(cameraSparql)} variant="outline" size="sm" className="w-full">
                                <Eye className="h-3 w-3 mr-1" /> Dettagli
                              </Button>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card className="border-dashed"><CardContent className="py-6 text-center text-sm text-muted-foreground">Nessuna da SPARQL</CardContent></Card>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Votazione più recente (Openpolis)</h3>
                        {cameraOpenpolis ? (
                          <Card className="transition-all hover:shadow-lg border-2 border-amber-200">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">
                                {formattaTitoloCompatto(cameraOpenpolis.titolo_votazione || cameraOpenpolis.descrizione_votazione || "Votazione")}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2 flex-wrap text-xs">
                                <Calendar className="h-3 w-3" />
                                {formatDate(cameraOpenpolis.data_votazione)}
                                {cameraOpenpolis.esito && (
                                  <Badge variant="outline" className={getEsitoColor(cameraOpenpolis.esito)}>{cameraOpenpolis.esito}</Badge>
                                )}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-2">
                              {(cameraOpenpolis.descrizione_votazione || cameraOpenpolis.descrizione) && (
                                <p className="text-xs text-gray-600 line-clamp-3">{cameraOpenpolis.descrizione_votazione || cameraOpenpolis.descrizione}</p>
                              )}
                              <Button onClick={() => handleVotazioneClick(cameraOpenpolis)} variant="outline" size="sm" className="w-full">
                                <Eye className="h-3 w-3 mr-1" /> Dettagli
                              </Button>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card className="border-dashed"><CardContent className="py-6 text-center text-sm text-muted-foreground">Nessuna da Openpolis</CardContent></Card>
                        )}
                      </div>
                    </div>
                    {/* Terza card: Combinato (sempre visibile) */}
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2">Combinato</h3>
                      {combinedCamera[0] ? (
                        <Card className="transition-all hover:shadow-lg border-2 border-amber-400">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">
                              {formattaTitoloCompatto(combinedCamera[0].titolo_votazione || combinedCamera[0].descrizione_votazione || "Votazione")}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 flex-wrap text-xs">
                              <Calendar className="h-3 w-3" />
                              {formatDate(combinedCamera[0].data_votazione)}
                              {combinedCamera[0].esito && (
                                <Badge variant="outline" className={getEsitoColor(combinedCamera[0].esito)}>{combinedCamera[0].esito}</Badge>
                              )}
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300">SPARQL + Openpolis</Badge>
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-2">
                            {(combinedCamera[0].descrizione_votazione || combinedCamera[0].descrizione) && (
                              <p className="text-xs text-gray-600 line-clamp-3">{combinedCamera[0].descrizione_votazione || combinedCamera[0].descrizione}</p>
                            )}
                            <Button onClick={() => handleVotazioneClick(combinedCamera[0])} variant="outline" size="sm" className="w-full">
                              <Eye className="h-3 w-3 mr-1" /> Dettagli
                            </Button>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="border-amber-200 border-dashed">
                          <CardContent className="py-6 text-center text-sm text-muted-foreground">
                            Non siamo riusciti a combinare i dati per la Camera (nessun abbinamento per data e camera tra SPARQL e Openpolis).
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sezione Dati combinati - due colonne: Senato | Camera */}
                {(combinedCamera.length > 0 || combinedSenato.length > 0) && (
                  <div>
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <Sparkles className="h-6 w-6 text-amber-600" />
                      Dati combinati
                    </h2>
                    <p className="text-muted-foreground mb-4 text-sm">
                      Questa sezione compare solo quando almeno una votazione è stata abbinata (stessa data e camera) tra SPARQL e Openpolis.
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Colonna sinistra: Senato combinato */}
                      {combinedSenato.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-purple-600" />
                          Senato della Repubblica
                        </h3>
                        <div className="space-y-4">
                          {combinedSenato.map((votazione, index) => (
                            <Card
                              key={`combined-senato-${votazione.votazione_id ?? index}`}
                              className={`transition-all hover:shadow-lg ${index === 0 ? "border-2 border-amber-500 shadow-md" : "border"}`}
                            >
                              <CardHeader>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <CardTitle className="text-xl">
                                        {formattaTitoloCompatto(votazione.titolo_votazione || votazione.descrizione || "Votazione senza titolo")}
                                      </CardTitle>
                                      {(votazione as { source?: string }).source === "combined" && (
                                        <Badge className="bg-amber-100 text-amber-800 border-amber-300">Combinato</Badge>
                                      )}
                                    </div>
                                    <CardDescription className="flex items-center gap-4 flex-wrap mt-2">
                                      <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4" />
                                        <Badge variant="outline" className={getCameraColor(votazione.camera)}>
                                          {votazione.camera || "N/A"}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        <span className="text-sm">{formatDate(votazione.data_votazione)}</span>
                                      </div>
                                      {votazione.esito && (
                                        <Badge variant="outline" className={getEsitoColor(votazione.esito)}>
                                          {votazione.esito}
                                        </Badge>
                                      )}
                                    </CardDescription>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                {(votazione.descrizione || votazione.descrizione_votazione) && (
                                  <p className="text-sm text-gray-700 leading-relaxed">
                                    {votazione.descrizione || votazione.descrizione_votazione}
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                  {votazione.legislatura && (
                                    <Badge variant="outline" className="text-xs">📜 Legislatura {votazione.legislatura}</Badge>
                                  )}
                                  {(votazione as { source?: string }).source === "combined" && (
                                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                                      ✨ SPARQL + Openpolis
                                    </Badge>
                                  )}
                                </div>
                                <div className="pt-4 border-t">
                                  <Button onClick={() => handleVotazioneClick(votazione)} variant="outline" className="w-full">
                                    <Eye className="h-4 w-4 mr-2" />
                                    Dettagli
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                      )}
                      {/* Colonna destra: Camera combinata */}
                      {combinedCamera.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-blue-600" />
                          Camera dei Deputati
                        </h3>
                        <div className="space-y-4">
                          {combinedCamera.map((votazione, index) => (
                            <Card
                              key={`combined-camera-${votazione.votazione_id ?? index}`}
                              className={`transition-all hover:shadow-lg ${index === 0 ? "border-2 border-amber-500 shadow-md" : "border"}`}
                            >
                              <CardHeader>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <CardTitle className="text-xl">
                                        {formattaTitoloCompatto(votazione.titolo_votazione || votazione.descrizione_votazione || "Votazione senza titolo")}
                                      </CardTitle>
                                      {(votazione as { source?: string }).source === "combined" && (
                                        <Badge className="bg-amber-100 text-amber-800 border-amber-300">Combinato</Badge>
                                      )}
                                    </div>
                                    <CardDescription className="flex items-center gap-4 flex-wrap mt-2">
                                      <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4" />
                                        <Badge variant="outline" className={getCameraColor(votazione.camera)}>
                                          {votazione.camera || "N/A"}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        <span className="text-sm">{formatDate(votazione.data_votazione)}</span>
                                      </div>
                                      {votazione.esito && (
                                        <Badge variant="outline" className={getEsitoColor(votazione.esito)}>
                                          {votazione.esito}
                                        </Badge>
                                      )}
                                    </CardDescription>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                {(votazione.descrizione_votazione || votazione.descrizione) && (
                                  <p className="text-sm text-gray-700 leading-relaxed">
                                    {votazione.descrizione_votazione || votazione.descrizione}
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                  {votazione.legislatura && (
                                    <Badge variant="outline" className="text-xs">📜 Legislatura {votazione.legislatura}</Badge>
                                  )}
                                  {(votazione as { source?: string }).source === "combined" && (
                                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                                      ✨ SPARQL + Openpolis
                                    </Badge>
                                  )}
                                </div>
                                <div className="pt-4 border-t">
                                  <Button onClick={() => handleVotazioneClick(votazione)} variant="outline" className="w-full">
                                    <Eye className="h-4 w-4 mr-2" />
                                    Dettagli
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Dialog Dettagli Votazione */}
        <Dialog open={!!selectedVotazione} onOpenChange={(open) => !open && setSelectedVotazione(null)}>
          <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100vh] !max-h-[100vh] !m-0 !rounded-none !left-0 !top-0 !translate-x-0 !translate-y-0 overflow-hidden flex flex-col p-6">
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-2xl flex items-center gap-2">
                    <Vote className="h-6 w-6 text-green-600 flex-shrink-0" />
                    {formattaTitoloCompatto(dettagliVotazione?.titolo || selectedVotazione?.titolo_votazione || "Dettagli Votazione")}
                  </DialogTitle>
                  <DialogDescription>
                    Informazioni complete sulla votazione parlamentare
                  </DialogDescription>
                </div>
                {selectedVotazione && isOpenpolisVotazione(selectedVotazione) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                    asChild
                  >
                    <a
                      href={selectedVotazione.uri || (selectedVotazione as { url_votazione?: string }).url_votazione || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Vedi su Openpolis →
                    </a>
                  </Button>
                )}
              </div>
            </DialogHeader>

            <ScrollArea className="flex-1 pr-4">
              <div className="pr-4">
              {loadingDettagli ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                  <p className="ml-4 text-muted-foreground">Caricamento dettagli...</p>
                </div>
              ) : dettagliVotazione ? (
                <div className="space-y-6 pb-4">
                  {/* Informazioni Generali, Statistiche Votazione, Descrizione e Informazioni Aggiuntive - Stessa Riga */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Informazioni Generali */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Info className="h-5 w-5" />
                        Informazioni Generali
                      </h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Camera</p>
                            <Badge variant="outline" className={getCameraColor(dettagliVotazione.camera)}>
                              {dettagliVotazione.camera}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Data</p>
                            <p className="text-sm font-medium">{formatDate(dettagliVotazione.data_votazione)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Esito</p>
                            <Badge variant="outline" className={getEsitoColor(dettagliVotazione.esito || null)}>
                              {dettagliVotazione.esito || "N/A"}
                            </Badge>
                          </div>
                          {dettagliVotazione.legislatura && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Legislatura</p>
                              <p className="text-sm font-medium">{dettagliVotazione.legislatura}</p>
                            </div>
                          )}
                          {dettagliVotazione.numero_seduta && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Seduta</p>
                              <p className="text-sm font-medium">n. {dettagliVotazione.numero_seduta}</p>
                            </div>
                          )}
                          {dettagliVotazione.tipo_votazione && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Tipo Votazione</p>
                              <p className="text-sm font-medium">{dettagliVotazione.tipo_votazione}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Statistiche Votazione */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Statistiche Votazione
                      </h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        {/* Grafico a torta per Favorevoli, Contrari, Astenuti */}
                        {(dettagliVotazione.favorevoli !== null || 
                          dettagliVotazione.contrari !== null || 
                          dettagliVotazione.astenuti !== null) && (
                          <div className="mb-4">
                            {(() => {
                              const data = [
                                ...(dettagliVotazione.favorevoli !== null ? [{
                                  name: 'Favorevoli',
                                  value: dettagliVotazione.favorevoli,
                                  color: '#22c55e'
                                }] : []),
                                ...(dettagliVotazione.contrari !== null ? [{
                                  name: 'Contrari',
                                  value: dettagliVotazione.contrari,
                                  color: '#ef4444'
                                }] : []),
                                ...(dettagliVotazione.astenuti !== null && dettagliVotazione.astenuti > 0 ? [{
                                  name: 'Astenuti',
                                  value: dettagliVotazione.astenuti,
                                  color: '#eab308'
                                }] : [])
                              ];
                              
                              const total = data.reduce((sum, item) => sum + item.value, 0);
                              
                              if (total > 0) {
                                return (
                                  <div className="space-y-3">
                                    <ResponsiveContainer width="100%" height={200}>
                                      <PieChart>
                                        <Pie
                                          data={data}
                                          cx="50%"
                                          cy="50%"
                                          labelLine={false}
                                          label={({ name, value, percent }) => 
                                            `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                                          }
                                          outerRadius={80}
                                          fill="#8884d8"
                                          dataKey="value"
                                        >
                                          {data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                          ))}
                                        </Pie>
                                        <Tooltip 
                                          formatter={(value: number) => [`${value} voti`, '']}
                                        />
                                        <Legend 
                                          formatter={(value) => {
                                            const item = data.find(d => d.name === value);
                                            return item ? `${value}: ${item.value}` : value;
                                          }}
                                        />
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                        
                        {/* Altre statistiche (Presenti, Votanti, Maggioranza) */}
                        <div className="grid grid-cols-2 gap-3">
                          {dettagliVotazione.presenti !== null && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Users className="h-4 w-4 text-blue-600" />
                                <p className="text-xs text-blue-700 font-medium">Presenti</p>
                              </div>
                              <p className="text-2xl font-bold text-blue-800">{dettagliVotazione.presenti}</p>
                            </div>
                          )}
                          {dettagliVotazione.votanti !== null && (
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Vote className="h-4 w-4 text-purple-600" />
                                <p className="text-xs text-purple-700 font-medium">Votanti</p>
                              </div>
                              <p className="text-2xl font-bold text-purple-800">{dettagliVotazione.votanti}</p>
                            </div>
                          )}
                          {dettagliVotazione.maggioranza !== null && (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Info className="h-4 w-4 text-indigo-600" />
                                <p className="text-xs text-indigo-700 font-medium">Maggioranza</p>
                              </div>
                              <p className="text-2xl font-bold text-indigo-800">{dettagliVotazione.maggioranza}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Descrizione */}
                    {dettagliVotazione.descrizione ? (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Descrizione</h3>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {dettagliVotazione.descrizione}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Descrizione</h3>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-sm text-gray-500 italic">Nessuna descrizione disponibile</p>
                        </div>
                      </div>
                    )}

                    {/* Informazioni Aggiuntive */}
                    {(dettagliVotazione.presidente || dettagliVotazione.titolo_seduta || dettagliVotazione.numero_legale) ? (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Informazioni Aggiuntive</h3>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="space-y-2 text-sm">
                            {dettagliVotazione.presidente && (
                              <div>
                                <p className="text-muted-foreground">Presidente:</p>
                                <p className="font-medium">{dettagliVotazione.presidente}</p>
                              </div>
                            )}
                            {dettagliVotazione.titolo_seduta && (
                              <div>
                                <p className="text-muted-foreground">Titolo Seduta:</p>
                                <p className="font-medium">{dettagliVotazione.titolo_seduta}</p>
                              </div>
                            )}
                            {dettagliVotazione.numero_legale && (
                              <div>
                                <p className="text-muted-foreground">Numero Legale:</p>
                                <p className="font-medium">{dettagliVotazione.numero_legale}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Informazioni Aggiuntive</h3>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-sm text-gray-500 italic">Nessuna informazione aggiuntiva disponibile</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Voti Nominali - Layout: Contrari (sinistra), Astenuti (centro), Favorevoli (destra) */}
                  {dettagliVotazione.voti_nominali && 
                   (dettagliVotazione.voti_nominali.favorevoli.length > 0 || 
                    dettagliVotazione.voti_nominali.contrari.length > 0 || 
                    dettagliVotazione.voti_nominali.astenuti.length > 0) && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <User className="h-5 w-5" />
                          Voti Nominali
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Contrari - Sinistra */}
                          {dettagliVotazione.voti_nominali.contrari.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-600" />
                                <h4 className="font-semibold text-red-800">
                                  Contrari ({dettagliVotazione.voti_nominali.contrari.length})
                                </h4>
                              </div>
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                                <div className="flex flex-wrap gap-2">
                                  {dettagliVotazione.voti_nominali.contrari.map((nome, i) => (
                                    <Badge key={i} variant="outline" className="bg-red-100 text-red-800 border-red-300">
                                      {nome}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Astenuti - Centro */}
                          {dettagliVotazione.voti_nominali.astenuti.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <MinusCircle className="h-4 w-4 text-yellow-600" />
                                <h4 className="font-semibold text-yellow-800">
                                  Astenuti ({dettagliVotazione.voti_nominali.astenuti.length})
                                </h4>
                              </div>
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                                <div className="flex flex-wrap gap-2">
                                  {dettagliVotazione.voti_nominali.astenuti.map((nome, i) => (
                                    <Badge key={i} variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                      {nome}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Favorevoli - Destra */}
                          {dettagliVotazione.voti_nominali.favorevoli.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <h4 className="font-semibold text-green-800">
                                  Favorevoli ({dettagliVotazione.voti_nominali.favorevoli.length})
                                </h4>
                              </div>
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                                <div className="flex flex-wrap gap-2">
                                  {dettagliVotazione.voti_nominali.favorevoli.map((nome, i) => (
                                    <Badge key={i} variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                      {nome}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}


                  {/* Spiegazione AI (legacy) */}
                  {dettagliVotazione.spiegazione && !dettagliVotazione.analisi_legge && (
                    <>
                      <Separator />
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-blue-600" />
                          <h3 className="text-lg font-semibold text-blue-900">Spiegazione AI</h3>
                        </div>
                        <p className="text-sm text-blue-900 leading-relaxed">
                          {dettagliVotazione.spiegazione}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Analisi Legge (nascosta per votazioni Openpolis) */}
                  {selectedVotazione && !isOpenpolisVotazione(selectedVotazione) && (
                  <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-purple-600" />
                        Analisi della Legge
                      </h2>
                      <Button
                        onClick={handleRigeneraAnalisi}
                        disabled={loadingDettagli || !selectedVotazione}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        {loadingDettagli ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Rigenerazione...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            Rigenera Analisi
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* Spiegazione Generale - Full Width */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-blue-600" />
                          Spiegazione Generale
                        </h3>
                        {/* Data di approvazione */}
                        {dettagliVotazione.data_votazione && (
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            Approvata il {new Date(dettagliVotazione.data_votazione).toLocaleDateString('it-IT', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </Badge>
                        )}
                      </div>
                      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-5 min-h-[120px]">
                        {dettagliVotazione.analisi_legge?.spiegazione_generale ? (
                          <>
                          <div className="text-sm text-blue-900 leading-relaxed">
                            {(() => {
                              const testo = dettagliVotazione.analisi_legge.spiegazione_generale;
                              const linee = testo.split('\n');
                              const risultato: JSX.Element[] = [];
                              let sezioneCorrente = '';
                              
                              linee.forEach((line, i) => {
                                const lineaTrim = line.trim();
                                if (!lineaTrim) return;
                                
                                // Rileva sezioni (COSA È, COSA FA, MISURE PREVISTE)
                                if (lineaTrim.match(/^(COSA È|COSA FA|MISURE PREVISTE):?$/i)) {
                                  sezioneCorrente = lineaTrim.toUpperCase();
                                  risultato.push(
                                    <h4 key={`header-${i}`} className="font-bold text-blue-800 mt-4 mb-2 first:mt-0">
                                      {lineaTrim.replace(/[:?]$/, '')}
                                    </h4>
                                  );
                                  return;
                                }
                                
                                // Rileva scadenze passate
                                const scadenze = rilevaScadenzePassate(lineaTrim);
                                const haScadenzePassate = scadenze.some(s => s.passata);
                                
                                // Formattazione per misure previste (formato compatto con →)
                                if (sezioneCorrente === 'MISURE PREVISTE' && lineaTrim.startsWith('•')) {
                                  let lineaFormattata = lineaTrim;
                                  
                                  // Evidenzia scadenze passate
                                  if (haScadenzePassate) {
                                    scadenze.forEach((scadenza) => {
                                      if (scadenza.passata) {
                                        const regex = new RegExp(`(${scadenza.data.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                                        lineaFormattata = lineaFormattata.replace(regex, (match) => {
                                          return `<span class="bg-red-200 text-red-900 font-semibold px-1 rounded">${match} ⚠️ (scadenza passata)</span>`;
                                        });
                                      }
                                    });
                                  }
                                  
                                  // Formatta → come freccia visiva
                                  lineaFormattata = lineaFormattata.replace(/→/g, '<span class="text-blue-600 font-semibold">→</span>');
                                  
                                  risultato.push(
                                    <div key={i} className="mb-1.5 ml-4" dangerouslySetInnerHTML={{ __html: lineaFormattata }} />
                                  );
                                  return;
                                }
                                
                                // Formattazione normale per altre sezioni
                                if (haScadenzePassate) {
                                  let lineaEvidenziata = lineaTrim;
                                  scadenze.forEach((scadenza) => {
                                    if (scadenza.passata) {
                                      const regex = new RegExp(`(${scadenza.data.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                                      lineaEvidenziata = lineaEvidenziata.replace(regex, (match) => {
                                        return `<span class="bg-red-200 text-red-900 font-semibold px-1 rounded">${match} ⚠️ (scadenza passata)</span>`;
                                      });
                                    }
                                  });
                                  risultato.push(
                                    <p key={i} className="mb-1.5" dangerouslySetInnerHTML={{ __html: lineaEvidenziata }} />
                                  );
                                } else if (lineaTrim.startsWith('•')) {
                                  risultato.push(
                                    <p key={i} className="mb-1.5 ml-4">{lineaTrim}</p>
                                  );
                                } else {
                                  risultato.push(
                                    <p key={i} className="mb-1.5">{lineaTrim}</p>
                                  );
                                }
                              });
                              
                              return risultato;
                            })()}
                          </div>
                            {dettagliVotazione.analisi_legge.numero_legge && (
                              <p className="text-xs text-blue-700 mt-3 font-semibold">
                                Legge n. {dettagliVotazione.analisi_legge.numero_legge}
                                {dettagliVotazione.analisi_legge.tipo_atto && ` - ${dettagliVotazione.analisi_legge.tipo_atto}`}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-full min-h-[80px]">
                            <p className="text-sm text-blue-700 italic">
                              {loadingDettagli ? (
                                <span className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Caricamento analisi...
                                </span>
                              ) : (
                                "Analisi in generazione. Ricarica la pagina tra qualche secondo."
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Effetti Positivi e Negativi - Side by Side */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Effetti Positivi */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          Effetti Positivi
                        </h3>
                        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-5 min-h-[200px]">
                          {dettagliVotazione.analisi_legge?.effetti_positivi ? (
                            <div className="text-sm text-green-900 leading-relaxed">
                              {dettagliVotazione.analisi_legge.effetti_positivi.split('\n').map((line, i) => {
                                const lineaTrim = line.trim();
                                if (!lineaTrim) return null;
                                
                                // Supporta formato ✓ o - o • o numeri
                                if (lineaTrim.match(/^[✓•-]\s/) || lineaTrim.match(/^\d+[\.)]\s/)) {
                                  const testo = lineaTrim.replace(/^[✓•-]\s/, '').replace(/^\d+[\.)]\s/, '');
                                  return (
                                    <div key={i} className="mb-1.5 flex items-start gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                      <span>{testo}</span>
                                    </div>
                                  );
                                }
                                // Se inizia già con ✓, mostra direttamente
                                if (lineaTrim.startsWith('✓')) {
                                  return (
                                    <div key={i} className="mb-1.5 flex items-start gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                      <span>{lineaTrim.substring(1).trim()}</span>
                                    </div>
                                  );
                                }
                                return <p key={i} className="mb-1.5">{lineaTrim}</p>;
                              })}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full min-h-[150px]">
                              <p className="text-sm text-green-700 italic text-center">
                                {loadingDettagli ? (
                                  <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Caricamento...
                                  </span>
                                ) : (
                                  "Analisi in generazione. Ricarica tra qualche secondo."
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Effetti Negativi */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <TrendingDown className="h-5 w-5 text-red-600" />
                          Effetti Negativi
                        </h3>
                        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-5 min-h-[200px]">
                          {dettagliVotazione.analisi_legge?.effetti_negativi ? (
                            <div className="text-sm text-red-900 leading-relaxed">
                              {dettagliVotazione.analisi_legge.effetti_negativi.split('\n').map((line, i) => {
                                const lineaTrim = line.trim();
                                if (!lineaTrim) return null;
                                
                                // Supporta formato ✗ o - o • o numeri
                                if (lineaTrim.match(/^[✗•-]\s/) || lineaTrim.match(/^\d+[\.)]\s/)) {
                                  const testo = lineaTrim.replace(/^[✗•-]\s/, '').replace(/^\d+[\.)]\s/, '');
                                  return (
                                    <div key={i} className="mb-1.5 flex items-start gap-2">
                                      <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                      <span>{testo}</span>
                                    </div>
                                  );
                                }
                                // Se inizia già con ✗, mostra direttamente
                                if (lineaTrim.startsWith('✗')) {
                                  return (
                                    <div key={i} className="mb-1.5 flex items-start gap-2">
                                      <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                      <span>{lineaTrim.substring(1).trim()}</span>
                                    </div>
                                  );
                                }
                                return <p key={i} className="mb-1.5">{lineaTrim}</p>;
                              })}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full min-h-[150px]">
                              <p className="text-sm text-red-700 italic text-center">
                                {loadingDettagli ? (
                                  <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Caricamento...
                                  </span>
                                ) : (
                                  "Analisi in generazione. Ricarica tra qualche secondo."
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-center">
                    Impossibile caricare i dettagli della votazione
                  </p>
                </div>
              )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
