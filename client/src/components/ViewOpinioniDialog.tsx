import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CustomAvatar } from "@/components/CustomAvatar";
import { useAuth } from "@/hooks/use-auth";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { apiRequest } from "@/lib/queryClient";

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
}

export function ViewOpinioniDialog({ 
  utenteId, 
  open, 
  onOpenChange,
  nome,
  cognome,
  avatarConfig
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
  const [tab, setTab] = useState<'opinioni' | 'sostegno' | 'altro'>('opinioni');

  // Carica le domande dinamiche
  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoadingQuestions(true);
      try {
        const res = await apiRequest("GET", "/api/opinioni-list");
        if (!res.ok) throw new Error();
        setQuestions(await res.json());
      } catch {
        toast({ title: "Errore", description: "Impossibile caricare le opinioni disponibili.", variant: "destructive" });
      } finally {
        setIsLoadingQuestions(false);
      }
    };
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (open && utenteId && questions.length > 0) {
      loadUserOpinions();
    }
    // eslint-disable-next-line
  }, [open, utenteId, questions]);

  // Carica le opinioni dell'utente loggato
  useEffect(() => {
    const fetchMyOpinions = async () => {
      if (!user) return;
      setIsLoadingMyOpinions(true);
      try {
        const res = await apiRequest("GET", "/api/opinioni");
        if (!res.ok) throw new Error();
        setMyOpinions(await res.json());
      } catch {
        setMyOpinions({});
      } finally {
        setIsLoadingMyOpinions(false);
      }
    };
    fetchMyOpinions();
  }, [user]);

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
        const response = await apiRequest("GET", `/api/opinioni-fonti/${utenteId}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        setFonti(data || {});
      } catch {
        setFonti({});
      } finally {
        setIsLoadingFonti(false);
      }
    };
    if (open) fetchFonti();
  }, [utenteId, open]);

  const loadUserOpinions = async () => {
    try {
      setIsLoadingOpinions(true);
      const response = await apiRequest("GET", `/api/users/${utenteId}`);
      if (!response.ok) {
        throw new Error('Errore nel caricamento delle opinioni');
      }
      const data = await response.json();
      if (data) {
        // Prendi tutte le opinioni con valore valido
        const filteredOpinions: Record<string, string> = {};
        Object.keys(data).forEach(key => {
          if (["Favorevole", "Indeciso", "Contrario"].includes(data[key])) {
            filteredOpinions[key] = data[key];
          }
        });
        setOpinions(filteredOpinions);
      }
    } catch (error) {
      console.error('Errore nel caricamento delle opinioni:', error);
      toast({
        title: "Errore",
        description: "Non è stato possibile caricare le opinioni dell'utente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingOpinions(false);
    }
  };

  // Funzione aggiornata per categorizzare tutte le opinioni, anche quelle non in questions
  const categorizeAllOpinions = () => {
    const favorevoli: { id: string, label: string }[] = [];
    const indecisi: { id: string, label: string }[] = [];
    const contrari: { id: string, label: string }[] = [];
    Object.entries(opinions).forEach(([key, value]) => {
      // Trova il testo della domanda dalla lista questions, altrimenti mostra l'ID
      const q = questions.find(q => q.id === key);
      const label = q ? q.text : key;
      if (value === "Favorevole") favorevoli.push({ id: key, label });
      else if (value === "Indeciso") indecisi.push({ id: key, label });
      else if (value === "Contrario") contrari.push({ id: key, label });
    });
    return { favorevoli, indecisi, contrari };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-w-full w-full h-full sm:h-auto sm:rounded-2xl p-0 sm:p-6 flex flex-col" style={{ maxHeight: '100dvh', minHeight: '100dvh', minWidth: '100vw', maxWidth: '100vw' }}>
        <DialogHeader>
          <div className="flex flex-col items-center justify-center w-full">
            {/* Avatar centrato */}
            {avatarConfig && (
              <div className="rounded-full overflow-hidden border-2 border-gray-300 shadow-sm mb-2" style={{ width: 64, height: 64 }}>
                <CustomAvatar config={JSON.parse(avatarConfig)} size={64} className="w-full h-full" />
              </div>
            )}
            {/* Nome utente centrato */}
            <div className="text-xl font-bold text-center mb-1">{nome && cognome ? `${nome} ${cognome}` : "Utente"}</div>
          </div>
        </DialogHeader>
        {/* Tabs contenuto */}
        <div className="min-h-[300px]">
          {tab === 'opinioni' && (
            <div>
              <div className="text-center text-muted-foreground mb-4">Visualizza le opinioni dell'utente su vari argomenti.</div>
              {/* Colonne Opinioni */}
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                {isLoadingOpinions || isLoadingQuestions || isLoadingMyOpinions ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Caricamento opinioni...</span>
                  </div>
                ) : Object.keys(opinions).length === 0 ? (
                  <div className="text-center p-6 text-muted-foreground">
                    Questo utente non ha ancora espresso opinioni.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-6">
                    {/* Colonna Favorevoli - Verde */}
                    <div className="space-y-3">
                      <div className="bg-green-100 border border-green-200 rounded-lg p-4">
                        <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          Favorevole
                        </h3>
                        <div className="space-y-2">
                          {categorizeAllOpinions().favorevoli.length > 0 ? (
                            categorizeAllOpinions().favorevoli.map(({ id, label }, index) => (
                              <div key={id} className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center justify-between">
                                <span className="text-green-800 font-medium">{label}</span>
                                {myOpinions[id] === opinions[id] ? <Check className="text-green-600 ml-2" size={20} /> : null}
                                {fonti[id] ? (
                                  <a href={fonti[id]} target="_blank" rel="noopener noreferrer" title="Fonte" className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 border border-blue-400">
                                    <AlertCircle className="text-blue-600" size={18} />
                                  </a>
                                ) : null}
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
                    {/* Colonna Indecisi - Giallo */}
                    <div className="space-y-3">
                      <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-4">
                        <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          Indeciso
                        </h3>
                        <div className="space-y-2">
                          {categorizeAllOpinions().indecisi.length > 0 ? (
                            categorizeAllOpinions().indecisi.map(({ id, label }, index) => (
                              <div key={id} className="bg-yellow-50 border border-yellow-200 rounded-md p-3 flex items-center justify-between">
                                <span className="text-yellow-800 font-medium">{label}</span>
                                {myOpinions[id] === opinions[id] ? <Check className="text-yellow-600 ml-2" size={20} /> : null}
                                {fonti[id] ? (
                                  <a href={fonti[id]} target="_blank" rel="noopener noreferrer" title="Fonte" className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 border border-blue-400">
                                    <AlertCircle className="text-blue-600" size={18} />
                                  </a>
                                ) : null}
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
                    {/* Colonna Contrari - Rosso */}
                    <div className="space-y-3">
                      <div className="bg-red-100 border border-red-200 rounded-lg p-4">
                        <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          Contrario
                        </h3>
                        <div className="space-y-2">
                          {categorizeAllOpinions().contrari.length > 0 ? (
                            categorizeAllOpinions().contrari.map(({ id, label }, index) => (
                              <div key={id} className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center justify-between">
                                <span className="text-red-800 font-medium">{label}</span>
                                {myOpinions[id] === opinions[id] ? <Check className="text-red-600 ml-2" size={20} /> : null}
                                {fonti[id] ? (
                                  <a href={fonti[id]} target="_blank" rel="noopener noreferrer" title="Fonte" className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 border border-blue-400">
                                    <AlertCircle className="text-blue-600" size={18} />
                                  </a>
                                ) : null}
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
                  </div>
                )}
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
        {/* Tab selector in basso */}
        <div className="flex justify-center gap-2 mt-6">
          <button className={`px-4 py-2 rounded ${tab === 'opinioni' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTab('opinioni')}>Opinioni</button>
          <button className={`px-4 py-2 rounded ${tab === 'sostegno' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTab('sostegno')}>Sostegno</button>
          <button className={`px-4 py-2 rounded ${tab === 'altro' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setTab('altro')}>Altro</button>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={() => onOpenChange(false)}>Chiudi</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}