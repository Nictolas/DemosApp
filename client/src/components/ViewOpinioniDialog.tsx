import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Check, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CustomAvatar } from "@/components/CustomAvatar";
import { useAuth } from "@/hooks/use-auth";
import { ViewProgrammaDialog } from "@/components/ViewProgrammaDialog";

import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

// Mappa colori per le risposte
const responseColors = {
  "f": "bg-green-100 text-green-800 border-green-500",
  "i": "bg-yellow-100 text-yellow-800 border-yellow-500",
  "c": "bg-red-100 text-red-800 border-red-500"
};

// Funzione per normalizzare le risposte (usa direttamente i valori compressi)
const normalizeAnswer = (answer: string | undefined) => {
  if (!answer || answer === null || answer === undefined) return null;
  // Usa direttamente i valori compressi
  if (answer === 'f' || answer === 'c' || answer === 'i') return answer;
  return null;
};

interface ViewOpinioniDialogProps {
  utenteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nome?: string;
  cognome?: string;
  avatarConfig?: string;
  categoria?: 'comune' | 'regione' | 'camera' | 'senato' | 'europeo';
}

export function ViewOpinioniDialog({ 
  utenteId, 
  open, 
  onOpenChange,
  nome,
  cognome,
  avatarConfig,
  categoria
}: ViewOpinioniDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [opinions, setOpinions] = useState<Record<string, string | null>>({});
  const [isLoadingOpinions, setIsLoadingOpinions] = useState(true);
  const [questions, setQuestions] = useState<{id: string, text: string}[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [myOpinions, setMyOpinions] = useState<Record<string, string>>({});
  const [isLoadingMyOpinions, setIsLoadingMyOpinions] = useState(true);
  const [likedIniziative, setLikedIniziative] = useState<string[]>([]);
  const [likedReferendum, setLikedReferendum] = useState<string[]>([]);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);
  const [fonti, setFonti] = useState<Record<string, string>>({});

  const [tab, setTab] = useState<'opinioni' | 'favorevole' | 'indeciso' | 'contrario' | 'sostegno' | 'altro'>('favorevole');
  const [, setLocation] = useLocation();
  const [showCambiaModal, setShowCambiaModal] = useState<{categoria: string | null} | false>(false);
  const [showProgrammaModal, setShowProgrammaModal] = useState(false);
  
  // Debug per tracciare l'utenteId
  console.log('🔍 ViewOpinioniDialog - utenteId corrente:', utenteId);
  console.log('🔍 ViewOpinioniDialog - showProgrammaModal:', showProgrammaModal);

  // Desktop: tab unificata "opinioni"; mobile: tab separate (favorevole/indeciso/contrario)
  useEffect(() => {
    if (!open) return;
    const isDesktop = window.matchMedia('(min-width: 640px)').matches;
    setTab(isDesktop ? 'opinioni' : 'favorevole');
  }, [open, utenteId]);

  // Funzione per redirect su "Cambia rappresentante"
  const handleCambia = () => {
    if (categoria) {
      setLocation(`/scegli-rappresentante/${categoria}`);
    } else {
      setLocation('/scegli-rappresentante');
    }
  };

  // Carica le domande dinamiche solo quando il dialog è aperto
  useEffect(() => {
    if (!open) return; // Non fare nulla se il dialog non è aperto
    
    const fetchQuestions = async () => {
      setIsLoadingQuestions(true);
      try {
        // Mappa la categoria al grado corretto
        const gradoMapping = {
          'europeo': 'E',
          'camera': 'N',
          'senato': 'N', 
          'regione': 'R',
          'comune': 'CO'
        };
        const grado = gradoMapping[categoria] || 'E';
        
        console.log(`🔍 DEBUG ViewOpinioniDialog - Categoria: ${categoria}, Grado: ${grado}`);
        console.log(`🔍 DEBUG ViewOpinioniDialog - utenteId: ${utenteId}`);
        
        // Chiama l'endpoint con il grado corretto basato sulla categoria
        const response = await apiRequest("GET", `/api/users/${utenteId}/opinioni?grado=${grado}`);
        console.log(`🔍 DEBUG ViewOpinioniDialog - Risposta API:`, response);
        
        if (!response?.ok || !response?.data) {
          console.log('🔍 DEBUG fetchQuestions - Risposta non ok o dati mancanti:', response);
          setQuestions([]);
          setOpinions({});
          return;
        }
        
        const result = response.data;
        console.log(`🔍 DEBUG ViewOpinioniDialog - result:`, result);
        
        if (result && result.success && result.data) {
          // Estrae le domande dalle opinioni ricevute
          const questionsArray = result.data.opinioni.map((opinion: any) => ({
            id: opinion.id,
            text: opinion.text
          }));
          console.log(`🔍 DEBUG fetchQuestions - Questions caricate da opinioni ${categoria} (grado ${grado}):`, questionsArray);
          setQuestions(questionsArray);
          
          // Carica anche le opinioni dell'utente selezionato
          const opinioniMap: Record<string, string | null> = {};
          console.log('🔍 DEBUG fetchQuestions - Opinioni raw ricevute:', result.data.opinioni);
          result.data.opinioni.forEach((opinion: any) => {
            console.log(`🔍 DEBUG fetchQuestions - Opinion ${opinion.id}: userAnswer = "${opinion.userAnswer}"`);
            // Mantieni null come null, non convertire in 'Astenuto'
            opinioniMap[opinion.id] = opinion.userAnswer;
          });
          console.log('🔍 DEBUG fetchQuestions - OpinionMap creata:', opinioniMap);
          setOpinions(opinioniMap);

          // Carica le fonti delle opinioni
          if (result.data.fonti) {
            console.log('🔍 DEBUG fetchQuestions - Fonti ricevute:', result.data.fonti);
            setFonti(result.data.fonti);
          } else {
            console.log('🔍 DEBUG fetchQuestions - Nessuna fonte ricevuta');
            setFonti({});
          }
        } else {
          console.log('🔍 DEBUG fetchQuestions - Nessuna question trovata o errore:', result);
          setQuestions([]);
          setOpinions({});
        }
      } catch {
        toast({ title: "Errore", description: "Impossibile caricare le opinioni disponibili.", variant: "destructive" });
      } finally {
        setIsLoadingQuestions(false);
        setIsLoadingOpinions(false); // Aggiunto per risolvere il loading infinito
      }
    };
    fetchQuestions();
  }, [open, utenteId, categoria]); // Aggiunto categoria come dipendenza

  // Le opinioni vengono ora caricate insieme alle domande nel primo useEffect

  // Carica le opinioni dell'utente corrente tramite API
  useEffect(() => {
    const fetchMyOpinions = async () => {
      if (!user?.id) return;
      setIsLoadingMyOpinions(true);
      try {
        // Mappa la categoria al grado corretto (stesso mapping del rappresentante)
        const gradoMapping = {
          'europeo': 'E',
          'camera': 'N',
          'senato': 'N', 
          'regione': 'R',
          'comune': 'CO'
        };
        const grado = gradoMapping[categoria] || 'E';
        
        console.log(`🔍 DEBUG fetchMyOpinions - Categoria: ${categoria}, Grado: ${grado}`);
        
        const response = await apiRequest("GET", `/api/users/${user.id}/opinioni?grado=${grado}`);
        console.log(`🔍 DEBUG fetchMyOpinions - Risposta API:`, response);
        
        if (!response?.ok || !response?.data) {
          console.log('🔍 DEBUG fetchMyOpinions - Risposta non ok o dati mancanti:', response);
          setMyOpinions({});
          return;
        }
        
        const result = response.data;
        
        if (result && result.success && result.data) {
          // Converte le opinioni nel formato atteso
          const opinioniMap: Record<string, string> = {};
          result.data.opinioni.forEach((opinion: any) => {
            if (opinion.userAnswer && opinion.userAnswer !== 'Astenuto') {
              opinioniMap[opinion.id] = opinion.userAnswer;
            }
          });
          console.log(`🔍 DEBUG fetchMyOpinions - OpinionMap creata:`, opinioniMap);
          setMyOpinions(opinioniMap);
        }
      } catch (error) {
        console.error('Errore nel caricamento delle opinioni da API:', error);
        setMyOpinions({});
      } finally {
        setIsLoadingMyOpinions(false);
      }
    };
    if (user && open) fetchMyOpinions();
  }, [user?.id, open, categoria]);

  // Carica le iniziative e i referendum a cui l'utente ha messo Like (per ora vuoto)
  useEffect(() => {
    const fetchLikes = async () => {
      if (!utenteId) return;
      setIsLoadingLikes(true);
      try {
        // Per ora non carichiamo i like, potrebbero non essere necessari
        setLikedIniziative([]);
        setLikedReferendum([]);
      } catch (e) {
        setLikedIniziative([]);
        setLikedReferendum([]);
      } finally {
        setIsLoadingLikes(false);
      }
    };
    if (open) fetchLikes();
  }, [utenteId, open]);

  // Le fonti vengono ora caricate insieme alle opinioni nel primo useEffect

  useEffect(() => {
    if (open) {
      console.log('🔍 DEBUG ViewOpinioniDialog - Stato attuale:');
      console.log('  - opinions:', opinions);
      console.log('  - questions:', questions);
      console.log('  - myOpinions:', myOpinions);
      console.log('  - isLoadingOpinions:', isLoadingOpinions);
      console.log('  - isLoadingQuestions:', isLoadingQuestions);
      console.log('  - isLoadingMyOpinions:', isLoadingMyOpinions);
      console.log('  - tab attivo:', tab);
      console.log('  - utenteId:', utenteId);
      
      // Debug per categorizeAllOpinionsDyn
      const categorized = categorizeAllOpinionsDyn();
      console.log('🔍 DEBUG categorizeAllOpinionsDyn result:', categorized);
    }
  }, [open, opinions, fonti, questions, myOpinions, isLoadingOpinions, isLoadingQuestions, isLoadingMyOpinions, tab, utenteId]);

  // La funzione loadUserOpinions è stata integrata nel primo useEffect

  // Funzione per categorizzare le opinioni del rappresentante selezionato
  function categorizeAllOpinionsDyn(): {favorevoli: {id: string, label: string}[], indecisi: {id: string, label: string}[], contrari: {id: string, label: string}[]} {
    const favorevoli: { id: string, label: string }[] = [];
    const indecisi: { id: string, label: string }[] = [];
    const contrari: { id: string, label: string }[] = [];
    
    // Usa le opinioni del rappresentante selezionato (opinions) invece di myOpinions
    Object.entries(opinions).forEach(([opinionId, value]) => {
      // Usa solo valori compressi, ignora null
      if (value === "f") {
        // Trova il testo della domanda dalle questions se disponibile, altrimenti usa l'ID
        const question = questions.find(q => q.id === opinionId);
        const label = question ? question.text : opinionId;
        favorevoli.push({ id: opinionId, label });
      }
      else if (value === "i") {
        const question = questions.find(q => q.id === opinionId);
        const label = question ? question.text : opinionId;
        indecisi.push({ id: opinionId, label });
      }
      else if (value === "c") {
        const question = questions.find(q => q.id === opinionId);
        const label = question ? question.text : opinionId;
        contrari.push({ id: opinionId, label });
      }
      // Ignora null e altri valori
    });
    
    console.log('DEBUG categorizeAllOpinionsDyn result:', { favorevoli, indecisi, contrari });
    return { favorevoli, indecisi, contrari };
  }

  // Funzione per determinare se due opinioni sono compatibili (stessa logica del backend)
  function isOpinioneComune(val1: string | undefined, val2: string | undefined) {
    // Normalizza le risposte come fa il backend
    const normalizedVal1 = normalizeAnswer(val1);
    const normalizedVal2 = normalizeAnswer(val2);

    // Conta come opinione comune solo se entrambi hanno risposto con una posizione valida e la risposta è identica
    return (
      normalizedVal1 && normalizedVal2 &&
      normalizedVal1 === normalizedVal2
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!top-0 !left-0 !flex !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-white p-0" style={{ maxHeight: '100dvh' }}>
        <DialogHeader className="shrink-0 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
          <DialogTitle className="text-center text-xl font-bold">
            {nome && cognome ? `${nome} ${cognome}` : "Utente"}
          </DialogTitle>
          <DialogDescription className="text-center">
            Visualizza le opinioni di questo rappresentante
          </DialogDescription>
        </DialogHeader>
        
        {/* Avatar centrato separato dal DialogTitle */}
        {avatarConfig && (
          <div className="flex shrink-0 justify-center mb-4">
            <div className="rounded-full overflow-hidden border-2 border-gray-300 shadow-sm" style={{ width: 64, height: 64 }}>
              <CustomAvatar config={JSON.parse(avatarConfig)} size={64} className="w-full h-full" />
            </div>
          </div>
        )}
        {/* Tabs contenuto */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {isLoadingOpinions || isLoadingQuestions ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Caricamento opinioni...</span>
            </div>
          ) : (
            <>
          {(() => {
            const { favorevoli, indecisi, contrari } = categorizeAllOpinionsDyn();
            const renderFavorevoli = () => (
              <div className="space-y-3">
                <div className="bg-green-100 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Favorevole
                  </h3>
                  <div className="space-y-2">
                    {favorevoli.length > 0 ? (
                      favorevoli.map(({ id, label }) => (
                        <div key={id} className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center justify-between">
                          <span className="text-green-800 font-medium">{label}</span>
                          <div className="flex items-center ml-2 gap-1">
                            {isOpinioneComune(myOpinions[id], opinions[id]) ? <Check className="text-green-600" size={20} /> : null}
                            {fonti[id] ? (
                              <a href={fonti[id]} target="_blank" rel="noopener noreferrer" title="Fonte" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 border border-blue-400">
                                <LinkIcon className="text-blue-600" size={18} />
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-green-600 text-sm italic">
                        Nessuna opinione favorevole
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
            const renderIndecisi = () => (
              <div className="space-y-3">
                <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    Indeciso
                  </h3>
                  <div className="space-y-2">
                    {indecisi.length > 0 ? (
                      indecisi.map(({ id, label }) => (
                        <div key={id} className="bg-yellow-50 border border-yellow-200 rounded-md p-3 flex items-center justify-between">
                          <span className="text-yellow-800 font-medium">{label}</span>
                          <div className="flex items-center ml-2 gap-1">
                            {isOpinioneComune(myOpinions[id], opinions[id]) ? <Check className="text-yellow-600" size={20} /> : null}
                            {fonti[id] ? (
                              <a href={fonti[id]} target="_blank" rel="noopener noreferrer" title="Fonte" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 border border-blue-400">
                                <LinkIcon className="text-blue-600" size={18} />
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-yellow-600 text-sm italic">
                        Nessuna opinione indecisa
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
            const renderContrari = () => (
              <div className="space-y-3">
                <div className="bg-red-100 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    Contrario
                  </h3>
                  <div className="space-y-2">
                    {contrari.length > 0 ? (
                      contrari.map(({ id, label }) => (
                        <div key={id} className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center justify-between">
                          <span className="text-red-800 font-medium">{label}</span>
                          <div className="flex items-center ml-2 gap-1">
                            {isOpinioneComune(myOpinions[id], opinions[id]) ? <Check className="text-red-600" size={20} /> : null}
                            {fonti[id] ? (
                              <a href={fonti[id]} target="_blank" rel="noopener noreferrer" title="Fonte" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 border border-blue-400">
                                <LinkIcon className="text-blue-600" size={18} />
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-red-600 text-sm italic">
                        Nessuna opinione contraria
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
            return (
              <>
                {/* Desktop: tutte e tre le colonne affiancate */}
                {tab === 'opinioni' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    {renderFavorevoli()}
                    {renderIndecisi()}
                    {renderContrari()}
                  </div>
                )}
                {/* Mobile: una colonna per tab */}
                {tab === 'favorevole' && (
                  <div className="grid grid-cols-1 gap-6">
                    {renderFavorevoli()}
                  </div>
                )}
                {tab === 'indeciso' && (
                  <div className="grid grid-cols-1 gap-6">
                    {renderIndecisi()}
                  </div>
                )}
                {tab === 'contrario' && (
                  <div className="grid grid-cols-1 gap-6">
                    {renderContrari()}
                  </div>
                )}
              </>
            );
          })()}
          {tab === 'sostegno' && (
            <div>
              {/* Sostegno: Iniziative popolari e Referendum abrogativi a cui ha messo Like */}
              <div className="mb-4">
                <h3 className="font-semibold text-lg mb-2">Iniziative popolari a cui ha messo Like</h3>
                {likedIniziative.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {likedIniziative.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted-foreground">Nessuna iniziativa popolare con Like.</div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Referendum abrogativi a cui ha messo Like</h3>
                {likedReferendum.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {likedReferendum.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted-foreground">Nessun referendum abrogativo con Like.</div>
                )}
              </div>
            </div>
          )}
          {tab === 'altro' && (
            <div className="text-center text-muted-foreground">Altre informazioni (placeholder)</div>
          )}
            </>
          )}
        </div>
        {/* Barra pulsanti nel layout del dialogo: resta al fondo senza sovrapporsi allo scroll */}
        <div className="z-10 flex w-full shrink-0 flex-col items-center justify-center gap-2 border-t border-gray-200 bg-white p-4 shadow-[0_-2px_8px_-2px_rgba(0,0,0,0.08)]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {/* Prima riga: filtri opinioni — mobile: 3 tab; desktop: solo Opinioni */}
          <div className="flex sm:hidden justify-center gap-2 w-full mb-2">
            <button className={`flex-1 px-4 py-2 rounded ${tab === 'favorevole' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTab('favorevole')}>Favorevole</button>
            <button className={`flex-1 px-4 py-2 rounded ${tab === 'indeciso' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTab('indeciso')}>Indeciso</button>
            <button className={`flex-1 px-4 py-2 rounded ${tab === 'contrario' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTab('contrario')}>Contrario</button>
          </div>
          <div className="hidden sm:flex justify-center gap-2 w-full mb-2">
            <button className={`flex-1 px-4 py-2 rounded ${tab === 'opinioni' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTab('opinioni')}>Opinioni</button>
          </div>
          {/* Seconda riga: azioni */}
          <div className="flex justify-center gap-2 w-full">
            <button className="flex-1 px-4 py-2 rounded bg-gray-100 text-gray-700" onClick={() => setShowProgrammaModal(true)}>Programma</button>
            <button className={`flex-1 px-4 py-2 rounded ${tab === 'sostegno' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTab('sostegno')}>Sostegno</button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>Chiudi</Button>
          </div>
        </div>
      </DialogContent>
      {/* Modal scelta tipo ricerca rappresentante */}
      {showCambiaModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-xs flex flex-col items-center">
            <h2 className="text-lg font-bold mb-4 text-center">Come vuoi cercare un nuovo rappresentante?</h2>
            <Button className="w-full mb-2" onClick={() => {
              setShowCambiaModal(false);
              if (showCambiaModal.categoria) {
                setLocation(`/scegli-rappresentante/${showCambiaModal.categoria}`);
              } else {
                setLocation('/scegli-rappresentante');
              }
            }}>Per compatibilità</Button>
            <Button className="w-full" variant="outline" onClick={() => { setShowCambiaModal(false); setLocation('/podio-trasparenza'); }}>Per merito</Button>
            <Button className="w-full mt-4" variant="ghost" onClick={() => setShowCambiaModal(false)}>Annulla</Button>
          </div>
        </div>
      )}
      
      {/* Modal programma */}
      {console.log('🚨🚨🚨 ViewOpinioniDialog: Passando utenteId a ViewProgrammaDialog:', utenteId)}
      <ViewProgrammaDialog
        utenteId={utenteId}
        open={showProgrammaModal}
        onOpenChange={setShowProgrammaModal}
        nome={nome}
        cognome={cognome}
        avatarConfig={avatarConfig}
      />
    </Dialog>
  );
}
