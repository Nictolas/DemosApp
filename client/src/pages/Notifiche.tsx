import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useFCM } from "@/hooks/useFCM";
import { ThumbsUp, ThumbsDown, Bell, Clock, User, Smartphone, Wifi } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, increment, getDoc, collection as collectionRef, getDocs, query as firestoreQuery, where as firestoreWhere } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CustomAvatar } from "@/components/CustomAvatar";
import { auth } from "@/lib/firebase";
import { NotificationTest } from "@/components/NotificationTest";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Notifica {
  id: string;
  comunicazione_id: string;
  destinatario_id: string;
  rappresentante_nome: string;
  rappresentante_cognome: string;
  titolo: string;
  voto_dato: string;
  commento?: string;
  vincitore: string;
  data_creazione: string;
  user_reaction?: "like" | "dislike" | null;
}

export default function Notifiche() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { token: fcmToken, error: fcmError, permission } = useFCM();
  const queryClient = useQueryClient();
  const [processingReaction, setProcessingReaction] = useState<string | null>(null);
  const [comunicazioni, setComunicazioni] = useState<any[]>([]);
  const [utentiMap, setUtentiMap] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  // Stato preferenze notifiche
  const [notifichePrefs, setNotifichePrefs] = useState({
    tutte: true,
    europeo: true,
    nazionale: true,
    regionale: true,
    comunale: true,
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    comunicazioneId: string | null;
    reaction: "like" | "dislike" | null;
  }>({ open: false, comunicazioneId: null, reaction: null });
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);
  const [skipConfirm, setSkipConfirm] = useState<boolean>(() => {
    return localStorage.getItem("skipLikeDislikeConfirm") === "true";
  });

  // 1. Funzione per calcolare la data limite (3 giorni fa)
  function getDataLimite() {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return d.toISOString();
  }

  // 2. Stato per dialog e dettagli
  const [dialogNotificaId, setDialogNotificaId] = useState<string | null>(null);
  const [dettagliNotifica, setDettagliNotifica] = useState<any | null>(null);

  // 3. Funzione per caricare dettagli solo al click
  async function fetchDettagliNotifica(id: string) {
    setDettagliNotifica(null);
    const snap = await getDoc(doc(db, "comunicazioni", id));
    setDettagliNotifica(snap.data());
  }

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    // Ottieni gli ID dei rappresentanti seguiti dall'utente
    const rappresentantiSeguiti = [
      user.rappresentante_europeo,
      user.rappresentante_camera,
      user.rappresentante_senato,
      user.rappresentante_regionale,
      user.rappresentante_comunale,
    ].filter(Boolean);
    console.log('Rappresentanti seguiti:', rappresentantiSeguiti);
    if (rappresentantiSeguiti.length === 0) {
      setComunicazioni([]);
      setUtentiMap({});
      setIsLoading(false);
      return;
    }
    // Query Firestore per comunicazioni dei rappresentanti seguiti
    try {
      const q = query(
        collection(db, "comunicazioni"),
        where("id_utente", "in", rappresentantiSeguiti)
        // rimosso orderBy("data_creazione", "desc")
      );
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setComunicazioni(docs);
        // Carica solo i rappresentanti con ruolo Politico o Candidato Politico seguiti dall'utente
        if (rappresentantiSeguiti.length > 0) {
          const utentiQuery = firestoreQuery(
            collectionRef(db, "utenti"),
            firestoreWhere("id", "in", rappresentantiSeguiti)
          );
          const utentiSnapshot = await getDocs(utentiQuery);
          const utenti: Record<string, any> = {};
          utentiSnapshot.forEach(doc => {
            utenti[doc.id] = doc.data();
          });
          console.log('Utenti trovati:', utenti);
          setUtentiMap(utenti);
        } else {
          setUtentiMap({});
        }
        setIsLoading(false);
      }, (error) => {
        console.error('Errore snapshot comunicazioni:', error);
        setIsLoading(false);
      });
      return () => unsubscribe();
    } catch (error) {
      console.error('Errore caricamento notifiche:', error);
      setIsLoading(false);
    }
  }, [user]);

  // Carica preferenze da Firestore
  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, "utenti", user.uid);
    getDoc(docRef).then((snap) => {
      if (snap.exists() && snap.data().notifiche_preferenze) {
        setNotifichePrefs({ ...notifichePrefs, ...snap.data().notifiche_preferenze });
      }
    });
    // eslint-disable-next-line
  }, [user]);
  // Salva preferenze su Firestore
  const updatePrefs = async (newPrefs: any) => {
    setNotifichePrefs(newPrefs);
    if (user) {
      const docRef = doc(db, "utenti", user.uid);
      await updateDoc(docRef, { notifiche_preferenze: newPrefs });
    }
  };
  // Gestione interruttori
  const handleSwitch = (key: string, value: boolean) => {
    if (key === "tutte") {
      const all = { tutte: value, europeo: value, nazionale: value, regionale: value, comunale: value };
      updatePrefs(all);
    } else {
      const newPrefs = { ...notifichePrefs, [key]: value };
      // Se tutte sono true, aggiorna anche 'tutte'
      newPrefs.tutte = newPrefs.europeo && newPrefs.nazionale && newPrefs.regionale && newPrefs.comunale;
      updatePrefs(newPrefs);
    }
  };

  // React to communication (like/dislike)
  const reactToCommunication = useMutation({
    mutationFn: async ({ comunicazioneId, reaction }: { comunicazioneId: string; reaction: "like" | "dislike" }) => {
      const response = await fetch(`/api/comunicazioni/${comunicazioneId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      });
      if (!response.ok) throw new Error("Errore nella reazione");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifiche"] });
      setProcessingReaction(null);
      toast({
        title: "Reazione registrata",
        description: `Hai ${variables.reaction === "like" ? "messo mi piace" : "messo non mi piace"} alla comunicazione.`,
      });
    },
    onError: (error: any) => {
      setProcessingReaction(null);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore nella reazione.",
        variant: "destructive",
      });
    },
  });

  // Funzione per mettere like/dislike con voto unico
  const handleReaction = async (comunicazioneId: string, reaction: "like" | "dislike") => {
    setProcessingReaction(comunicazioneId);
    try {
      const comunicazioneRef = doc(db, "comunicazioni", comunicazioneId);
      const comunicazioneSnap = await getDoc(comunicazioneRef);
      const data = comunicazioneSnap.data();
      if (!data) throw new Error("Comunicazione non trovata");
      const voti = data.voti || {};
      if (voti[user.id]) {
        toast({
          title: "Hai già votato",
          description: `Hai già espresso la tua preferenza per questa comunicazione.`,
          variant: "destructive",
        });
        setProcessingReaction(null);
        return;
      }
      // Aggiorna il voto e il contatore
      await updateDoc(comunicazioneRef, {
        [reaction === "like" ? "likes" : "dislikes"]: increment(1),
        [`voti.${user.id}`]: reaction,
      });
      toast({
        title: "Reazione registrata",
        description: `Hai messo ${reaction === "like" ? "mi piace" : "non mi piace"} alla comunicazione.`,
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore nella reazione.",
        variant: "destructive",
      });
    } finally {
      setProcessingReaction(null);
    }
  };

  const handleReactionClick = (comunicazioneId: string, reaction: "like" | "dislike") => {
    if (skipConfirm) {
      handleReaction(comunicazioneId, reaction);
    } else {
      setConfirmDialog({ open: true, comunicazioneId, reaction });
    }
  };
  const handleConfirm = () => {
    if (confirmDialog.comunicazioneId && confirmDialog.reaction) {
      handleReaction(confirmDialog.comunicazioneId, confirmDialog.reaction);
      if (dontShowAgain) {
        setSkipConfirm(true);
        localStorage.setItem("skipLikeDislikeConfirm", "true");
      }
    }
    setConfirmDialog({ open: false, comunicazioneId: null, reaction: null });
    setDontShowAgain(false);
  };
  const handleCancel = () => {
    setConfirmDialog({ open: false, comunicazioneId: null, reaction: null });
    setDontShowAgain(false);
  };

  const getReactionColor = (reaction: string | null) => {
    switch (reaction) {
      case "like":
        return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20";
      case "dislike":
        return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20";
      default:
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Notifiche</h1>
              <p className="text-muted-foreground">Caricamento notifiche...</p>
            </div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <div className="w-3/4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div className="w-1/2 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div className="flex space-x-2">
                        <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ordinamento lato client per grado_elezione
  const ordineGradi = ["Europeo", "Nazionale", "Regionale", "Comunale"];
  const comunicazioniOrdinate = (comunicazioni as any[]).filter(comunicazione => {
    const utente = utentiMap[comunicazione.id_utente];
    return utente && (utente.ruolo === "Politico" || utente.ruolo === "Candidato Politico");
  }).sort((a, b) => {
    return ordineGradi.indexOf(a.grado_elezione) - ordineGradi.indexOf(b.grado_elezione);
  });

  // Mappa ruolo -> chiave rappresentante utente
  const rappresentantiKeys = [
    { label: "Eurodeputato", key: "rappresentante_europeo", color: "bg-blue-200", url: "https://www.demos.community/scegli-rappresentante/europeo" },
    { label: "Deputato", key: "rappresentante_camera", color: "bg-green-200", url: "https://www.demos.community/scegli-rappresentante/camera" },
    { label: "Senatore", key: "rappresentante_senato", color: "bg-yellow-200", url: "https://www.demos.community/scegli-rappresentante/senato" },
    { label: "Consigliere Regionale", key: "rappresentante_regionale", color: "bg-purple-200", url: "https://www.demos.community/scegli-rappresentante/regione" },
    { label: "Consigliere Comunale", key: "rappresentante_comunale", color: "bg-pink-200", url: "https://www.demos.community/scegli-rappresentante/comune" },
  ];

  // Funzione per trovare l'ultima comunicazione per rappresentante
  const getUltimaComunicazione = (rappresentanteId: string) => {
    if (!rappresentanteId) return null;
    const filtered = comunicazioni
      .filter(c => c.id_utente === rappresentanteId)
      .sort((a, b) => (b.data_creazione || "").localeCompare(a.data_creazione || ""));
    return filtered[0] || null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Notifiche</h1>
            <p className="text-muted-foreground">Le tue ultime notifiche dai rappresentanti scelti</p>
          </div>
          <div className="flex flex-col gap-6 mb-8">
            {rappresentantiKeys.map(({ label, key, color, url }) => {
              const rappresentanteId = user?.[key];
              // Filtra solo le ultime 3 notifiche degli ultimi 3 giorni
              const anteprime = comunicazioni
                .filter(c => c.id_utente === rappresentanteId && c.data_creazione > getDataLimite())
                .sort((a, b) => (b.data_creazione || "").localeCompare(a.data_creazione || ""));
              const rappresentante = rappresentanteId ? utentiMap?.[rappresentanteId] : null;
              return (
                <Card key={key} className="shadow-md w-full">
                  <CardHeader className="flex flex-row items-center gap-2">
                    <span className={`inline-block w-3 h-3 rounded-full ${color}`}></span>
                    <CardTitle className="text-lg">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {rappresentanteId ? (
                      anteprime.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {anteprime.map(notifica => (
                            <div
                              key={notifica.id}
                              className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 rounded p-2"
                              onClick={() => {
                                setDialogNotificaId(notifica.id);
                                fetchDettagliNotifica(notifica.id);
                              }}
                            >
                              {rappresentante && rappresentante.avatar_config ? (
                                <CustomAvatar config={JSON.parse(rappresentante.avatar_config)} size={28} className="mr-1" />
                              ) : (
                                <User className="h-7 w-7 text-blue-600 mr-1" />
                              )}
                              <span className="font-semibold">{rappresentante?.nome} {rappresentante?.cognome}</span>
                              <span>ha comunicato una votazione:</span>
                              <span className="font-medium">{notifica.titolo}</span>
                              <span className="text-xs text-gray-500">{new Date(notifica.data_creazione).toLocaleString("it-IT")}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Nessuna comunicazione recente.</div>
                      )
                    ) : (
                      <Button asChild variant="outline" className="w-full mt-2">
                        <a href={url} target="_blank" rel="noopener noreferrer">Scegli Rappresentante</a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Switch preferenze notifiche push */}
          <Card className="mb-6">
            <CardContent className="p-4 space-y-2">
              <div className="font-medium mb-2">Preferenze Notifiche Push</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Tutte le notifiche</span>
                  <Switch checked={notifichePrefs.tutte} onCheckedChange={v => handleSwitch('tutte', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Rappresentante Europeo</span>
                  <Switch checked={notifichePrefs.europeo} onCheckedChange={v => handleSwitch('europeo', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Rappresentante Nazionale</span>
                  <Switch checked={notifichePrefs.nazionale} onCheckedChange={v => handleSwitch('nazionale', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Rappresentante Regionale</span>
                  <Switch checked={notifichePrefs.regionale} onCheckedChange={v => handleSwitch('regionale', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Consigliere Comunale</span>
                  <Switch checked={notifichePrefs.comunale} onCheckedChange={v => handleSwitch('comunale', v)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stato notifiche push */}
          <div className="mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Smartphone className="h-5 w-5 text-blue-600" />
                    <div>
                      <h3 className="font-medium">Notifiche Push</h3>
                      <p className="text-sm text-muted-foreground">
                        Ricevi notifiche anche quando l'app è chiusa
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={permission === 'granted' ? 'default' : 'secondary'}
                      className="flex items-center space-x-1"
                    >
                      <Wifi className="h-3 w-3" />
                      {permission === 'granted' ? 'Attive' : permission === 'denied' ? 'Negate' : 'Non richieste'}
                    </Badge>
                  </div>
                </div>
                
                {fcmError && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertDescription>
                      Errore notifiche: {fcmError}
                    </AlertDescription>
                  </Alert>
                )}
                
                {fcmToken && (
                  <Alert className="mt-3">
                    <AlertDescription>
                      Token FCM: {fcmToken}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Pulsante di test per notifiche push */}
                {fcmToken && user && (
                  <div className="mt-3 space-y-2">
                    <Button 
                      onClick={async () => {
                        try {
                          const currentUser = auth.currentUser;
                          if (!currentUser) throw new Error("Utente non autenticato in Firebase");
                          const token = await currentUser.getIdToken();
                          const response = await fetch('/api/test-push-notification', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              userId: user.uid,
                              title: 'Test Notifica DEMOS',
                              body: 'Questa è una notifica di test inviata alle ' + new Date().toLocaleTimeString()
                            })
                          });
                          const result = await response.json();
                          if (result.success) {
                            toast({
                              title: "Notifica di test inviata",
                              description: "Controlla se hai ricevuto la notifica push",
                            });
                          } else {
                            toast({
                              title: "Errore",
                              description: result.error || "Errore nell'invio della notifica di test",
                              variant: "destructive",
                            });
                          }
                        } catch (error) {
                          toast({
                            title: "Errore",
                            description: error.message || "Errore di rete nell'invio della notifica di test",
                            variant: "destructive",
                          });
                        }
                      }}
                      size="sm"
                      className="w-full"
                    >
                      Test Notifica Push
                    </Button>
                    
                    {/* Pulsante per visualizzare token salvati (solo per debug) */}
                    <Button 
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/notifications/tokens');
                          const result = await response.json();
                          if (result.success) {
                            console.log('Token FCM salvati:', result);
                            toast({
                              title: "Token FCM salvati",
                              description: `${result.count} token trovati. Controlla la console per i dettagli.`,
                            });
                          } else {
                            toast({
                              title: "Errore",
                              description: result.error || "Errore nel recupero dei token",
                              variant: "destructive",
                            });
                          }
                        } catch (error) {
                          toast({
                            title: "Errore",
                            description: "Errore di rete nel recupero dei token",
                            variant: "destructive",
                          });
                        }
                      }}
                      size="sm"
                      variant="outline"
                      className="w-full"
                    >
                      Debug: Visualizza Token Salvati
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Test e salvataggio notifiche push (debug) */}
          {user && <NotificationTest userId={user.uid} />}

          {!isLoading && comunicazioni.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Bell className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nessuna notifica</h3>
                <p className="text-muted-foreground">
                  Nessuna comunicazione trovata per i rappresentanti seguiti.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {/* Dialog di conferma */}
      <AlertDialog open={confirmDialog.open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma la tua scelta</AlertDialogTitle>
            <AlertDialogDescription>
              Una volta cliccato, non potrai più modificare il voto. Sei sicuro di voler procedere?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Checkbox id="dontShowAgain" checked={dontShowAgain} onCheckedChange={setDontShowAgain} />
            <label htmlFor="dontShowAgain" className="text-sm select-none cursor-pointer">Non ripetermelo più</label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Procedi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Dettaglio Notifica (lazy) */}
      {dialogNotificaId && (
        <Dialog open={!!dialogNotificaId} onOpenChange={() => setDialogNotificaId(null)}>
          <DialogContent>
            {!dettagliNotifica ? (
              <div>Caricamento dettagli...</div>
            ) : (
              <div>
                <DialogHeader>
                  <DialogTitle>{dettagliNotifica.titolo}</DialogTitle>
                </DialogHeader>
                <div><b>Nome:</b> {dettagliNotifica.nome} {dettagliNotifica.cognome}</div>
                <div><b>Data:</b> {new Date(dettagliNotifica.data_creazione).toLocaleString("it-IT")}</div>
                <div><b>Commento:</b> {dettagliNotifica.commento || "Nessun commento"}</div>
                <div><b>Voto:</b> {dettagliNotifica.voto_dato}</div>
                <div><b>Risultato:</b> <Badge variant="outline" className={`ml-2 ${
                  dettagliNotifica.vincitore === "Approvata"
                    ? "bg-green-500 text-white border-green-500"
                    : dettagliNotifica.vincitore === "Respinta"
                    ? "bg-red-500 text-white border-red-500"
                    : ""
                }`}>{dettagliNotifica.vincitore}</Badge></div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}