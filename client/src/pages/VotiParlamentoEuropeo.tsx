import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { PageContainer } from "@/components/PageContainer";
import { Loader2, ArrowLeft, Vote, AlertCircle, RefreshCw, Calendar, Building2, Sparkles, Users, CheckCircle2, XCircle, MinusCircle, Info, Eye, TrendingUp, TrendingDown, BookOpen, Globe, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface VotazioneParlamentoEuropeo {
  id: number;
  uri: string;
  votazione_id: string;
  titolo: string;
  descrizione: string | null;
  data_votazione: string | null;
  esito: string | null;
  sessione_id: string | null;
  sessione_data: string | null;
  sessione_label: string | null;
  favorevoli: number | null;
  contrari: number | null;
  astenuti: number | null;
  presenti: number | null;
  votanti: number | null;
  termine_parlamentare: string | null;
  metadati: any;
  data_sincronizzazione: string;
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

interface VotoMEPItaliano {
  id: string;
  nome_completo: string;
  nome?: string;
  cognome?: string;
  gruppo_politico?: string;
}

interface VotiNominaliMEPItaliani {
  favorevoli: VotoMEPItaliano[];
  contrari: VotoMEPItaliano[];
  astenuti: VotoMEPItaliano[];
  assenti: VotoMEPItaliano[];
  disponibili?: boolean;
  linkDocumento?: string;
  messaggio?: string;
}

interface DettagliVotazione extends VotazioneParlamentoEuropeo {
  analisi_legge?: AnalisiLegge | null;
  voti_nominali_mep_italiani?: VotiNominaliMEPItaliani | null;
}

// Funzioni helper (stesse di VotiParlamento.tsx)
function isRiferimentoLegge(testoPrimaData: string): boolean {
  const testoLower = testoPrimaData.toLowerCase();
  const riferimentiNormativi = [
    'legge', 'decreto', 'dl', 'ddl', 'd.l.', 'd.d.l.', 'decreto-legge',
    'decreto legge', 'legge n.', 'legge numero', 'd.lgs.', 'd.p.r.',
    'del decreto', 'della legge', 'dell\'articolo', 'dell\'art.',
    'articolo', 'art.', 'comma', 'alinea', 'lettera', 'regolamento', 'direttiva'
  ];
  
  return riferimentiNormativi.some(rif => {
    const pattern = new RegExp(`\\b${rif}\\s*(?:n\\.?|numero|del|della|dell')?\\s*$`, 'i');
    return pattern.test(testoPrimaData);
  });
}

function rilevaScadenzePassate(testo: string): Array<{ data: string; testo: string; passata: boolean }> {
  const scadenze: Array<{ data: string; testo: string; passata: boolean }> = [];
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  
  const patternDate = /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/gi;
  const mesi: { [key: string]: number } = {
    'gennaio': 1, 'febbraio': 2, 'marzo': 3, 'aprile': 4, 'maggio': 5, 'giugno': 6,
    'luglio': 7, 'agosto': 8, 'settembre': 9, 'ottobre': 10, 'novembre': 11, 'dicembre': 12
  };
  
  let match;
  while ((match = patternDate.exec(testo)) !== null) {
    const giorno = parseInt(match[1]);
    const mese = mesi[match[2].toLowerCase()];
    const anno = parseInt(match[3]);
    const data = new Date(anno, mese - 1, giorno);
    data.setHours(0, 0, 0, 0);
    
    const inizioMatch = Math.max(0, match.index - 100);
    const testoPrimaData = testo.substring(inizioMatch, match.index);
    
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

function evidenziaScadenzePassate(testo: string): string {
  const scadenze = rilevaScadenzePassate(testo);
  let testoEvidenziato = testo;
  
  scadenze.forEach((scadenza) => {
    if (scadenza.passata) {
      const regex = new RegExp(scadenza.data.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      testoEvidenziato = testoEvidenziato.replace(regex, `<span class="bg-yellow-200 text-yellow-900 px-1 rounded-sm font-semibold">${scadenza.data} ⚠️ (scadenza passata)</span>`);
    }
  });
  
  return testoEvidenziato;
}

function formattaTitoloCompatto(titolo: string): string {
  // Abbrevia titoli lunghi del PE
  let titoloCompatto = titolo;
  
  // Sostituzioni comuni
  titoloCompatto = titoloCompatto.replace(/Votazione\s+/gi, '');
  titoloCompatto = titoloCompatto.replace(/Parlamento\s+Europeo/gi, 'PE');
  titoloCompatto = titoloCompatto.replace(/Regolamento\s+(?:\(UE\)|\(CE\))\s*(\d+)/gi, 'Reg. UE $1');
  titoloCompatto = titoloCompatto.replace(/Direttiva\s+(?:\(UE\)|\(CE\))\s*(\d+)/gi, 'Dir. UE $1');
  
  return titoloCompatto;
}

export default function VotiParlamentoEuropeo() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [votazioneSelezionata, setVotazioneSelezionata] = useState<DettagliVotazione | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Query per recuperare le ultime votazioni
  const { data: votazioniData, isLoading, error, refetch } = useQuery({
    queryKey: ['voti-parlamento-europeo'],
    queryFn: async () => {
      console.log('🔍 VotiParlamentoEuropeo - Inizio query');
      try {
        const response = await apiRequest.get<{ success: boolean; data: VotazioneParlamentoEuropeo[]; count: number }>(
          '/api/voti-parlamento-europeo/ultime?limit=10'
        );
        console.log('✅ VotiParlamentoEuropeo - Risposta ricevuta:', response);
        
        // apiRequest.get() restituisce {ok, status, data, json}
        // dove data contiene la risposta JSON dal server
        const responseData = response.data;
        console.log('📦 VotiParlamentoEuropeo - response.data:', responseData);
        
        if (!responseData || !responseData.success) {
          console.error('❌ VotiParlamentoEuropeo - responseData.success è false:', responseData);
          throw new Error('Errore nel recupero delle votazioni');
        }
        console.log('📊 VotiParlamentoEuropeo - Dati:', responseData.data);
        return responseData.data;
      } catch (error) {
        console.error('❌ VotiParlamentoEuropeo - Errore nella query:', error);
        throw error;
      }
    },
    retry: 1,
    retryDelay: 1000
  });

  // Query per recuperare i dettagli di una votazione
  const { data: dettagliData, isLoading: isLoadingDettagli } = useQuery({
    queryKey: ['voti-parlamento-europeo-dettagli', votazioneSelezionata?.uri],
    queryFn: async () => {
      if (!votazioneSelezionata?.uri) return null;
        const response = await apiRequest.get<{ success: boolean; data: DettagliVotazione }>(
          `/api/voti-parlamento-europeo/dettagli/${encodeURIComponent(votazioneSelezionata.uri)}`
        );
        const responseData = response.data;
        if (!responseData || !responseData.success) {
          throw new Error('Errore nel recupero dei dettagli');
        }
        return responseData.data;
    },
    enabled: !!votazioneSelezionata?.uri && isDialogOpen
  });

  const handleVotazioneClick = (votazione: VotazioneParlamentoEuropeo) => {
    setVotazioneSelezionata(votazione);
    setIsDialogOpen(true);
  };

  const handleRigeneraAnalisi = async () => {
    if (!votazioneSelezionata?.uri) return;
    
    try {
        const response = await apiRequest.post<{ success: boolean; data: AnalisiLegge }>(
          `/api/voti-parlamento-europeo/rigenera-analisi/${encodeURIComponent(votazioneSelezionata.uri)}`
        );
        
        const responseData = response.data;
        if (responseData && responseData.success && votazioneSelezionata) {
          setVotazioneSelezionata({
            ...votazioneSelezionata,
            analisi_legge: responseData.data
          });
        toast({
          title: "Analisi rigenerata",
          description: "L'analisi è stata rigenerata con successo.",
        });
      }
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile rigenerare l'analisi.",
        variant: "destructive",
      });
    }
  };

  const votazioni = votazioniData || [];

  // Prepara i dati per il grafico a torta
  const datiGrafico = votazioneSelezionata && dettagliData ? [
    { name: 'Favorevoli', value: dettagliData.favorevoli || 0, color: '#22c55e' },
    { name: 'Contrari', value: dettagliData.contrari || 0, color: '#ef4444' },
    { name: 'Astenuti', value: dettagliData.astenuti || 0, color: '#f59e0b' }
  ].filter(item => item.value > 0) : [];

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Globe className="h-8 w-8 text-blue-600" />
                Voti Parlamento Europeo
              </h1>
              <p className="text-muted-foreground mt-1">
                Ultime votazioni del Parlamento Europeo
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              console.log('🔄 Pulsante Aggiorna cliccato');
              try {
                await refetch();
                console.log('✅ Refetch completato');
              } catch (error) {
                console.error('❌ Errore nel refetch:', error);
              }
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Errore nel caricamento delle votazioni. Riprova più tardi.
            </AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Lista Votazioni */}
        {!isLoading && !error && votazioni.length === 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Nessuna votazione trovata. Prova ad aggiornare i dati.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && votazioni.length > 0 && (
          <div className="grid gap-4">
            {votazioni.map((votazione) => (
              <Card
                key={votazione.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleVotazioneClick(votazione)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {formattaTitoloCompatto(votazione.titolo)}
                      </CardTitle>
                      {votazione.sessione_label && (
                        <CardDescription className="mt-1">
                          {votazione.sessione_label}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant={votazione.esito === 'Approvato' ? 'default' : 'secondary'}>
                      {votazione.esito || 'In corso'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {votazione.data_votazione && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(votazione.data_votazione), 'd MMMM yyyy', { locale: it })}
                      </div>
                    )}
                    {votazione.favorevoli !== null && votazione.contrari !== null && (
                      <div className="flex items-center gap-1">
                        <Vote className="h-4 w-4" />
                        {votazione.favorevoli} favorevoli, {votazione.contrari} contrari
                        {votazione.astenuti !== null && `, ${votazione.astenuti} astenuti`}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dialog Dettagli */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {votazioneSelezionata && formattaTitoloCompatto(votazioneSelezionata.titolo)}
              </DialogTitle>
              <DialogDescription>
                {votazioneSelezionata?.sessione_label && (
                  <div className="mt-2">
                    <Badge variant="outline">{votazioneSelezionata.sessione_label}</Badge>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[70vh] pr-4">
              {isLoadingDettagli ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : dettagliData ? (
                <div className="space-y-6">
                  {/* Statistiche Votazione */}
                  {(dettagliData.favorevoli !== null || dettagliData.contrari !== null) && (
                    <Card>
                      <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Users className="h-5 w-5" />
                              Statistiche Votazione
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                              {datiGrafico.length > 0 && (
                                <div className="col-span-2">
                                  <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                      <Pie
                                        data={datiGrafico}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                      >
                                        {datiGrafico.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                      <Tooltip />
                                      <Legend />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              )}
                              <div className="space-y-2">
                                {dettagliData.favorevoli !== null && (
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span className="text-sm">Favorevoli: <strong>{dettagliData.favorevoli}</strong></span>
                                  </div>
                                )}
                                {dettagliData.contrari !== null && (
                                  <div className="flex items-center gap-2">
                                    <XCircle className="h-4 w-4 text-red-600" />
                                    <span className="text-sm">Contrari: <strong>{dettagliData.contrari}</strong></span>
                                  </div>
                                )}
                                {dettagliData.astenuti !== null && (
                                  <div className="flex items-center gap-2">
                                    <MinusCircle className="h-4 w-4 text-yellow-600" />
                                    <span className="text-sm">Astenuti: <strong>{dettagliData.astenuti}</strong></span>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2">
                                {dettagliData.presenti !== null && (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    <span className="text-sm">Presenti: <strong>{dettagliData.presenti}</strong></span>
                                  </div>
                                )}
                                {dettagliData.votanti !== null && (
                                  <div className="flex items-center gap-2">
                                    <Vote className="h-4 w-4" />
                                    <span className="text-sm">Votanti: <strong>{dettagliData.votanti}</strong></span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                  {/* Voti MEP Italiani */}
                  {dettagliData.voti_nominali_mep_italiani && (
                    <>
                      <Separator />
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Voti MEP Italiani
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {dettagliData.voti_nominali_mep_italiani.favorevoli.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                Favorevoli ({dettagliData.voti_nominali_mep_italiani.favorevoli.length})
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {dettagliData.voti_nominali_mep_italiani.favorevoli.map((mep, index) => (
                                  <Badge key={index} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    {mep.nome_completo}
                                    {mep.gruppo_politico && ` (${mep.gruppo_politico})`}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {dettagliData.voti_nominali_mep_italiani.contrari.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2 text-red-600">
                                <XCircle className="h-4 w-4" />
                                Contrari ({dettagliData.voti_nominali_mep_italiani.contrari.length})
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {dettagliData.voti_nominali_mep_italiani.contrari.map((mep, index) => (
                                  <Badge key={index} variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                    {mep.nome_completo}
                                    {mep.gruppo_politico && ` (${mep.gruppo_politico})`}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {dettagliData.voti_nominali_mep_italiani.astenuti.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2 text-yellow-600">
                                <MinusCircle className="h-4 w-4" />
                                Astenuti ({dettagliData.voti_nominali_mep_italiani.astenuti.length})
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {dettagliData.voti_nominali_mep_italiani.astenuti.map((mep, index) => (
                                  <Badge key={index} variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                    {mep.nome_completo}
                                    {mep.gruppo_politico && ` (${mep.gruppo_politico})`}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {dettagliData.voti_nominali_mep_italiani.assenti && dettagliData.voti_nominali_mep_italiani.assenti.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2 text-gray-600">
                                <User className="h-4 w-4" />
                                Assenti ({dettagliData.voti_nominali_mep_italiani.assenti.length})
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {dettagliData.voti_nominali_mep_italiani.assenti.map((mep, index) => (
                                  <Badge key={index} variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                                    {mep.nome_completo}
                                    {mep.gruppo_politico && ` (${mep.gruppo_politico})`}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {dettagliData.voti_nominali_mep_italiani.favorevoli.length === 0 &&
                           dettagliData.voti_nominali_mep_italiani.contrari.length === 0 &&
                           dettagliData.voti_nominali_mep_italiani.astenuti.length === 0 &&
                           (!dettagliData.voti_nominali_mep_italiani.assenti || dettagliData.voti_nominali_mep_italiani.assenti.length === 0) && (
                            <Alert>
                              <Info className="h-4 w-4" />
                              <AlertDescription>
                                {dettagliData.voti_nominali_mep_italiani.messaggio || 'I voti dei MEP italiani non sono ancora disponibili per questa votazione.'}
                                {dettagliData.voti_nominali_mep_italiani.linkDocumento && (
                                  <div className="mt-2">
                                    <a 
                                      href={dettagliData.voti_nominali_mep_italiani.linkDocumento} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline"
                                    >
                                      Consulta il documento ufficiale →
                                    </a>
                                  </div>
                                )}
                              </AlertDescription>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  )}

                  {/* Analisi Legge */}
                  {dettagliData.analisi_legge && (
                    <>
                      <Separator />
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Sparkles className="h-5 w-5" />
                              Analisi AI
                            </CardTitle>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRigeneraAnalisi}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Rigenera Analisi
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {dettagliData.analisi_legge.spiegazione_generale && (
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <BookOpen className="h-4 w-4" />
                                Spiegazione Generale
                              </h4>
                              <div
                                className="prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{
                                  __html: evidenziaScadenzePassate(dettagliData.analisi_legge.spiegazione_generale)
                                    .replace(/\n/g, '<br />')
                                    .replace(/→/g, '<span class="text-blue-600 font-semibold">→</span>')
                                }}
                              />
                            </div>
                          )}
                          {dettagliData.analisi_legge.effetti_positivi && (
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-green-600" />
                                Effetti Positivi
                              </h4>
                              <ul className="list-none space-y-1">
                                {dettagliData.analisi_legge.effetti_positivi
                                  .split('\n')
                                  .filter(line => line.trim())
                                  .map((line, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                      <span className="text-green-600 mt-1">✓</span>
                                      <span>{line.replace(/^[✓•-]\s*/, '').trim()}</span>
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          )}
                          {dettagliData.analisi_legge.effetti_negativi && (
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <TrendingDown className="h-4 w-4 text-red-600" />
                                Effetti Negativi
                              </h4>
                              <ul className="list-none space-y-1">
                                {dettagliData.analisi_legge.effetti_negativi
                                  .split('\n')
                                  .filter(line => line.trim())
                                  .map((line, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                      <span className="text-red-600 mt-1">✗</span>
                                      <span>{line.replace(/^[✗•-]\s*/, '').trim()}</span>
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Dettagli non disponibili per questa votazione.
                  </AlertDescription>
                </Alert>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
