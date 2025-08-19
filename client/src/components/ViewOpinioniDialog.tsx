import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Check, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CustomAvatar } from "@/components/CustomAvatar";
import { useAuth } from "@/hooks/use-auth-neon";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase-stub";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

// Mappa colori per le risposte
const responseColors = {
  "Favorevole": "bg-green-100 text-green-800 border-green-500",
  "Indeciso": "bg-yellow-100 text-yellow-800 border-yellow-500",
  "Contrario": "bg-red-100 text-red-800 border-red-500"
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
  const [opinions, setOpinions] = useState<Record<string, string>>({});
  const [isLoadingOpinions, setIsLoadingOpinions] = useState(true);
  const [questions, setQuestions] = useState<{id: string, text: string}[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [myOpinions, setMyOpinions] = useState<Record<string, string>>({});
  const [isLoadingMyOpinions, setIsLoadingMyOpinions] = useState(true);
  const [likedIniziative, setLikedIniziative] = useState<string[]>([]);
  const [likedReferendum, setLikedReferendum] = useState<string[]>([]);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);
  const [fonti, setFonti] = useState<Record<string, string>>({});
  const [isLoadingFonti, setIsLoadingFonti] = useState(false);
  const [tab, setTab] = useState<'favorevole' | 'indeciso' | 'contrario' | 'sostegno' | 'altro'>('favorevole');
  const [, setLocation] = useLocation();
  const [showCambiaModal, setShowCambiaModal] = useState<{categoria: string | null} | false>(false);

  // Funzione per redirect su "Cambia rappresentante"
  const handleCambia = () => {
    if (categoria) {
      setLocation(`/scegli-rappresentante/${categoria}`);
    } else {
      setLocation('/scegli-rappresentante');
    }
  };

  // Carica le domande dinamiche
  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoadingQuestions(true);
      try {
        const res = await apiRequest("GET", "/api/opinioni-list");
        if (!res.ok) throw new Error();
        const result = await res.json();
        // Gestisce sia il formato nuovo (con success/data) che quello vecchio (array diretto)
        const questions = result.success ? result.data : result;
        setQuestions(Array.isArray(questions) ? questions : []);
      } catch {
        toast({ title: "Errore", description: "Impossibile caricare le opinioni disponibili.", variant: "destructive" });
      } finally {
        setIsLoadingQuestions(false);
      }
    };
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (open && utenteId && Array.isArray(questions) && questions.length > 0) {
      loadUserOpinions();
    }
    // eslint-disable-next-line
  }, [open, utenteId, questions]);

  // Sostituisco la useEffect che carica le opinioni dell'utente loggato tramite API con una che le carica da Firestore
  useEffect(() => {
    const fetchMyOpinions = async () => {
      if (!user) return;
      setIsLoadingMyOpinions(true);
      try {
        const userDoc = await getDoc(doc(db, "utenti", user.uid));
        if (!userDoc.exists()) {
          setMyOpinions({});
          return;
        }
        const data = userDoc.data();
        // Recupera la lista delle domande dinamiche
        let opinioniList: {id: string, text: string}[] = Array.isArray(questions) ? questions : [];
        // Filtra solo i campi che sono opinioni
        const opinioni: Record<string, string> = {};
        for (const key of Object.keys(data)) {
          if (
            opinioniList.find(q => q.id === key) ||
            [
              'energia_nucleare',
              'sperimentazione_animale',
              'legalizzazione_canapa',
              'caccia'
            ].includes(key)
          ) {
            opinioni[key] = data[key];
          }
        }
        setMyOpinions(opinioni);
      } catch {
        setMyOpinions({});
      } finally {
        setIsLoadingMyOpinions(false);
      }
    };
    if (user && open && Array.isArray(questions) && questions.length > 0) fetchMyOpinions();
    // eslint-disable-next-line
  }, [user, open, questions]);

  // Carica le iniziative e i referendum a cui l'utente ha messo Like
  useEffect(() => {
    const fetchLikes = async () => {
      if (!utenteId) return;
      setIsLoadingLikes(true);
      try {
        // Recupera i Like alle iniziative popolari
        const qIniz = query(collection(db, "voti_iniziative_popolari"), where("userId", "==", utenteId));
        const snapIniz = await getDocs(qIniz);
        const iniziativaIds = snapIniz.docs.map(doc => doc.data().iniziativaId);
        // Recupera i nomi delle iniziative
        const iniziativeNomi = await Promise.all(
          iniziativaIds.map(async (id: string) => {
            const docRef = doc(db, "iniziative_popolari", id);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? docSnap.data().nome : null;
          })
        );
        setLikedIniziative(iniziativeNomi.filter(Boolean));

        // Recupera i Like ai referendum abrogativi
        const qRef = query(collection(db, "voti_referendum_abrogativi"), where("userId", "==", utenteId));
        const snapRef = await getDocs(qRef);
        const referendumIds = snapRef.docs.map(doc => doc.data().referendumId);
        // Recupera i nomi dei referendum
        const referendumNomi = await Promise.all(
          referendumIds.map(async (id: string) => {
            const docRef = doc(db, "referendum_abrogativi", id);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? docSnap.data().nome : null;
          })
        );
        setLikedReferendum(referendumNomi.filter(Boolean));
      } catch (e) {
        setLikedIniziative([]);
        setLikedReferendum([]);
      } finally {
        setIsLoadingLikes(false);
      }
    };
    if (open) fetchLikes();
  }, [utenteId, open]);

  // Carica le fonti delle opinioni
  useEffect(() => {
    const fetchFonti = async () => {
      if (!utenteId) return;
      setIsLoadingFonti(true);
      try {
        const userDoc = await getDoc(doc(db, "utenti", utenteId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setFonti(data.fonti_opinioni || {});
        } else {
          setFonti({});
        }
      } catch {
        setFonti({});
      } finally {
        setIsLoadingFonti(false);
      }
    };
    if (open) fetchFonti();
  }, [utenteId, open]);

  useEffect(() => {
    if (open) {
      console.log('DEBUG opinioni:', opinions);
      console.log('DEBUG fonti:', fonti);
      console.log('DEBUG questions:', questions);
    }
  }, [open, opinions, fonti, questions]);

  const loadUserOpinions = async () => {
    try {
      setIsLoadingOpinions(true);
      const userDoc = await getDoc(doc(db, "utenti", utenteId));
      if (!userDoc.exists()) {
        setOpinions({});
        return;
      }
      const data = userDoc.data();
      // Recupera la lista delle domande dinamiche
      let opinioniList: {id: string, text: string}[] = questions;
      // Filtra solo i campi che sono opinioni
      const opinioni: Record<string, string> = {};
      for (const key of Object.keys(data)) {
        if (
          opinioniList.find(q => q.id === key) ||
          [
            'energia_nucleare',
            'sperimentazione_animale',
            'legalizzazione_canapa',
            'caccia'
          ].includes(key)
        ) {
          opinioni[key] = data[key];
        }
      }
      setOpinions(opinioni);
    } catch (error) {
      console.error('Errore nel caricamento delle opinioni da Firestore:', error);
      toast({
        title: "Errore",
        description: "Non è stato possibile caricare le opinioni dell'utente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingOpinions(false);
    }
  };

  // Sostituisco la funzione categorizeAllOpinions con una versione che cicla su tutte le domande attive (questions)
  function categorizeAllOpinionsDyn(): {favorevoli: {id: string, label: string}[], indecisi: {id: string, label: string}[], contrari: {id: string, label: string}[]} {
    const favorevoli: { id: string, label: string }[] = [];
    const indecisi: { id: string, label: string }[] = [];
    const contrari: { id: string, label: string }[] = [];
    questions.forEach((q: {id: string, text: string}) => {
      const value = opinions[q.id];
      if (value === "Favorevole") favorevoli.push({ id: q.id, label: q.text });
      else if (value === "Indeciso") indecisi.push({ id: q.id, label: q.text });
      else if (value === "Contrario") contrari.push({ id: q.id, label: q.text });
    });
    return { favorevoli, indecisi, contrari };
  }

  // Funzione per determinare se due opinioni sono compatibili (come nel calcolo compatibilità)
  function isOpinioneComune(val1: string | undefined, val2: string | undefined) {
    return (
      typeof val1 === 'string' && val1.trim() !== '' &&
      typeof val2 === 'string' && val2.trim() !== '' &&
      val1 === val2
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-w-full w-full h-full sm:h-auto sm:rounded-2xl p-0 sm:p-6 flex flex-col" style={{ maxHeight: '100dvh', minHeight: '100dvh', minWidth: '100vw', maxWidth: '100vw' }}>
        <DialogHeader>
          <div className="flex flex-col items-center justify-center w-full">
            {/* Avatar centrato */}
            {avatarConfig && (
              <div className="rounded-full overflow-hidden border-2 border-gray-300 shadow-sm mb-2 mt-4" style={{ width: 64, height: 64 }}>
                <CustomAvatar config={JSON.parse(avatarConfig)} size={64} className="w-full h-full" />
              </div>
            )}
            {/* Nome utente centrato */}
            <div className="text-xl font-bold text-center mb-1">{nome && cognome ? `${nome} ${cognome}` : "Utente"}</div>
          </div>
        </DialogHeader>
        {/* Tabs contenuto */}
        <div className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: 120 }}>
          {tab === 'favorevole' && (
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6 md:gap-6">
              {/* Colonna Favorevoli - Verde */}
              <div className="space-y-3">
                <div className="bg-green-100 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Favorevole
                  </h3>
                  <div className="space-y-2">
                    {categorizeAllOpinionsDyn().favorevoli.length > 0 ? (
                      categorizeAllOpinionsDyn().favorevoli.map(({ id, label }, index) => (
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
            </div>
          )}
          {tab === 'indeciso' && (
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6 md:gap-6">
              {/* Colonna Indecisi - Giallo */}
              <div className="space-y-3">
                <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    Indeciso
                  </h3>
                  <div className="space-y-2">
                    {categorizeAllOpinionsDyn().indecisi.length > 0 ? (
                      categorizeAllOpinionsDyn().indecisi.map(({ id, label }, index) => (
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
            </div>
          )}
          {tab === 'contrario' && (
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6 md:gap-6">
              {/* Colonna Contrari - Rosso */}
              <div className="space-y-3">
                <div className="bg-red-100 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    Contrario
                  </h3>
                  <div className="space-y-2">
                    {categorizeAllOpinionsDyn().contrari.length > 0 ? (
                      categorizeAllOpinionsDyn().contrari.map(({ id, label }, index) => {
                        const fonteKey = id;
                        return (
                          <div key={id} className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center justify-between">
                            <span className="text-red-800 font-medium">{label}</span>
                            <div className="flex items-center ml-2 gap-1">
                              {isOpinioneComune(myOpinions[id], opinions[id]) ? <Check className="text-red-600" size={20} /> : null}
                              {fonti[fonteKey] ? (
                                <a href={fonti[fonteKey]} target="_blank" rel="noopener noreferrer" title="Fonte" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 border border-blue-400">
                                  <LinkIcon className="text-blue-600" size={18} />
                                </a>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-red-600 text-sm italic">
                        Nessuna opinione contraria
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
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
        </div>
        {/* Barra pulsanti fissa in basso */}
        <div className="w-full bg-white shadow-[0_-2px_8px_-2px_rgba(0,0,0,0.08),0_2px_8px_-2px_rgba(0,0,0,0.08)] border-t border-gray-200 border-b border-gray-200 flex flex-col items-center justify-center gap-2 p-4 fixed left-0 right-0 bottom-0 sm:static sm:shadow-none sm:border-0" style={{ zIndex: 50, marginBottom: 80 }}>
          {/* Prima riga: filtri opinioni */}
          <div className="flex justify-center gap-2 w-full mb-2">
            <button className={`flex-1 px-4 py-2 rounded ${tab === 'favorevole' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTab('favorevole')}>Favorevole</button>
            <button className={`flex-1 px-4 py-2 rounded ${tab === 'indeciso' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTab('indeciso')}>Indeciso</button>
            <button className={`flex-1 px-4 py-2 rounded ${tab === 'contrario' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTab('contrario')}>Contrario</button>
          </div>
          {/* Seconda riga: azioni */}
          <div className="flex justify-center gap-2 w-full">
            <button className="flex-1 px-4 py-2 rounded bg-gray-100 text-gray-700" onClick={() => { onOpenChange(false); setTimeout(() => setShowCambiaModal({categoria: categoria || null}), 200); }}>Cambia</button>
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
    </Dialog>
  );
}