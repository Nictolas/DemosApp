import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Building2, User, Users, Scale, Shield, Banknote, Briefcase, GraduationCap, Heart, Palette, Vote, Trophy, Leaf, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, query, where } from "firebase/firestore";

interface Classifica { nome: string; voti: number; }

const ministeri = [
  { title: "Primo Ministro", categoria: "primo_ministro", icon: User, description: "Presidenza del Consiglio dei Ministri", color: "bg-red-100 text-red-600" },
  { title: "Ministro degli Esteri", categoria: "esteri", icon: Building2, description: "Relazioni internazionali e cooperazione", color: "bg-blue-100 text-blue-600" },
  { title: "Ministro dell'Interno", categoria: "interno", icon: Shield, description: "Sicurezza pubblica e amministrazione territoriale", color: "bg-green-100 text-green-600" },
  { title: "Ministro della Giustizia", categoria: "giustizia", icon: Scale, description: "Sistema giudiziario e carcerario", color: "bg-purple-100 text-purple-600" },
  { title: "Ministro della Difesa", categoria: "difesa", icon: Shield, description: "Forze armate e sicurezza nazionale", color: "bg-gray-100 text-gray-600" },
  { title: "Ministro dell'Economia e delle Finanze", categoria: "economia", icon: Banknote, description: "Politiche economiche e fiscali", color: "bg-yellow-100 text-yellow-600" },
  { title: "Ministro del Lavoro e delle Politiche Sociali", categoria: "lavoro", icon: Briefcase, description: "Occupazione e previdenza sociale", color: "bg-orange-100 text-orange-600" },
  { title: "Ministro dell'Istruzione", categoria: "istruzione", icon: GraduationCap, description: "Sistema educativo e formazione", color: "bg-indigo-100 text-indigo-600" },
  { title: "Ministro della Salute", categoria: "salute", icon: Heart, description: "Sanità pubblica e politiche sanitarie", color: "bg-pink-100 text-pink-600" },
  { title: "Ministro della Cultura", categoria: "cultura", icon: Palette, description: "Patrimonio culturale e spettacolo", color: "bg-teal-100 text-teal-600" },
  { title: "Ministro dell'Ambiente della Sicurezza Energetica", categoria: "ambiente_sicurezza_energetica", icon: Leaf, description: "Tutela dell'ambiente e sicurezza energetica", color: "bg-lime-100 text-lime-600" }
];

export default function Governo() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userVoti, setUserVoti] = useState<{ [categoria: string]: string }>({});
  const [classifiche, setClassifiche] = useState<{ [categoria: string]: Classifica[] }>({});
  const [loading, setLoading] = useState(true);
  const [isVoting, setIsVoting] = useState<{ [categoria: string]: boolean }>({});
  const [input, setInput] = useState<{ [categoria: string]: string }>({});
  const [deletingVote, setDeletingVote] = useState<{ [categoria: string]: boolean }>({});

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    async function fetchData() {
      const snap = await getDocs(collection(db, "voti_ministri"));
      const votiList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Classifiche per categoria
      const classTemp: { [categoria: string]: Classifica[] } = {};
      const userVotiTemp: { [categoria: string]: string } = {};
      ministeri.forEach(m => {
        const votiCat = votiList.filter(v => v.categoria === m.categoria);
        // Classifica
        const conteggio: Record<string, number> = {};
        votiCat.forEach(v => {
          if (v.nomeMinistro) conteggio[v.nomeMinistro] = (conteggio[v.nomeMinistro] || 0) + 1;
        });
        classTemp[m.categoria] = Object.entries(conteggio)
          .map(([nome, voti]) => ({ nome, voti: Number(voti) }))
          .sort((a, b) => b.voti - a.voti);
        // Voto utente
        const mioVoto = votiCat.find(v => v.userId === user.uid);
        userVotiTemp[m.categoria] = mioVoto ? mioVoto.nomeMinistro : "";
      });
      setClassifiche(classTemp);
      setUserVoti(userVotiTemp);
      setInput(userVotiTemp);
      setLoading(false);
    }
    fetchData();
  }, [user]);

  const handleVote = async (categoria: string) => {
    if (!user) return;
    const nomeMinistro = input[categoria]?.trim();
    if (!nomeMinistro) {
      toast({ title: "Errore", description: "Inserisci un nome valido", variant: "destructive" });
      return;
    }
    if (userVoti[categoria] === nomeMinistro) {
      toast({ title: "Voto già registrato", description: `Hai già votato per ${nomeMinistro}` });
      return;
    }
    setIsVoting(v => ({ ...v, [categoria]: true }));
    try {
      // Rimuovi eventuale voto precedente
      const q = query(collection(db, "voti_ministri"), where("userId", "==", user.uid), where("categoria", "==", categoria));
      const snap = await getDocs(q);
      for (const docu of snap.docs) {
        await deleteDoc(docu.ref);
      }
      // Aggiungi nuovo voto
      await addDoc(collection(db, "voti_ministri"), {
        categoria,
        nomeMinistro,
        nomeDisplay: nomeMinistro,
        userId: user.uid,
        timestamp: new Date().toISOString()
      });
      toast({ title: "Voto registrato", description: `Hai votato ${nomeMinistro}` });
      // Ricarica dati
      const snapAll = await getDocs(collection(db, "voti_ministri"));
      const votiList = snapAll.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const classTemp: { [categoria: string]: Classifica[] } = {};
      const userVotiTemp: { [categoria: string]: string } = {};
      ministeri.forEach(m => {
        const votiCat = votiList.filter(v => v.categoria === m.categoria);
        const conteggio: Record<string, number> = {};
        votiCat.forEach(v => {
          if (v.nomeMinistro) conteggio[v.nomeMinistro] = (conteggio[v.nomeMinistro] || 0) + 1;
        });
        classTemp[m.categoria] = Object.entries(conteggio)
          .map(([nome, voti]) => ({ nome, voti: Number(voti) }))
          .sort((a, b) => b.voti - a.voti);
        const mioVoto = votiCat.find(v => v.userId === user.uid);
        userVotiTemp[m.categoria] = mioVoto ? mioVoto.nomeMinistro : "";
      });
      setClassifiche(classTemp);
      setUserVoti(userVotiTemp);
      setInput(userVotiTemp);
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setIsVoting(v => ({ ...v, [categoria]: false }));
    }
  };

  const removeVote = async (categoria: string) => {
    if (!user) return;
    setDeletingVote(v => ({ ...v, [categoria]: true }));
    try {
      const q = query(collection(db, "voti_ministri"), where("userId", "==", user.uid), where("categoria", "==", categoria));
      const snap = await getDocs(q);
      for (const docu of snap.docs) {
        await deleteDoc(docu.ref);
      }
      toast({ title: "Voto rimosso", description: "Hai rimosso il tuo voto." });
      // Ricarica dati
      const snapAll = await getDocs(collection(db, "voti_ministri"));
      const votiList = snapAll.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const classTemp: { [categoria: string]: Classifica[] } = {};
      const userVotiTemp: { [categoria: string]: string } = {};
      ministeri.forEach(m => {
        const votiCat = votiList.filter(v => v.categoria === m.categoria);
        const conteggio: Record<string, number> = {};
        votiCat.forEach(v => {
          if (v.nomeMinistro) conteggio[v.nomeMinistro] = (conteggio[v.nomeMinistro] || 0) + 1;
        });
        classTemp[m.categoria] = Object.entries(conteggio)
          .map(([nome, voti]) => ({ nome, voti: Number(voti) }))
          .sort((a, b) => b.voti - a.voti);
        const mioVoto = votiCat.find(v => v.userId === user.uid);
        userVotiTemp[m.categoria] = mioVoto ? mioVoto.nomeMinistro : "";
      });
      setClassifiche(classTemp);
      setUserVoti(userVotiTemp);
      setInput(userVotiTemp);
    } catch (error) {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setDeletingVote(v => ({ ...v, [categoria]: false }));
    }
  };

  if (!authReady || isLoading || loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-7xl">
        <Button 
          variant="ghost" 
          className="mb-4 flex items-center"
          onClick={() => window.location.href = "/menu"}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
        </Button>
        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-700 rounded-full">
                <Building2 className="h-12 w-12 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Governo
            </CardTitle>
            <CardDescription className="text-lg">
              Vota per i tuoi ministri preferiti e visualizza le classifiche
            </CardDescription>
          </CardHeader>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ministeri.map((ministero) => (
            <Card key={ministero.categoria} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-3 rounded-lg ${ministero.color}`}>
                    <ministero.icon className="h-6 w-6" />
                  </div>
                  {userVoti[ministero.categoria] && (
                    <Badge variant="default">
                      <Vote className="h-3 w-3 mr-1" />
                      Votato
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg leading-tight">
                  {ministero.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {ministero.description}
                </p>
                {/* Form di voto */}
                <form onSubmit={e => { e.preventDefault(); handleVote(ministero.categoria); }} className="space-y-2">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Nome del candidato..."
                      value={input[ministero.categoria] || ""}
                      onChange={e => setInput(i => ({ ...i, [ministero.categoria]: e.target.value }))}
                      className="flex-1"
                    />
                    <Button 
                      type="submit" 
                      size="sm" 
                      disabled={isVoting[ministero.categoria] || !(input[ministero.categoria] && input[ministero.categoria].trim())}
                    >
                      {isVoting[ministero.categoria] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Vote className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {userVoti[ministero.categoria] && (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">
                        Il tuo voto attuale: <strong>{userVoti[ministero.categoria]}</strong>
                      </p>
                      <Button
                        type="button"
                        size="xs"
                        variant="destructive"
                        className="ml-2"
                        onClick={() => removeVote(ministero.categoria)}
                        disabled={deletingVote[ministero.categoria]}
                      >
                        {deletingVote[ministero.categoria] ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                      </Button>
                    </div>
                  )}
                </form>
                {/* Classifica */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center">
                    <Trophy className="h-4 w-4 mr-1 text-yellow-500" />
                    Top 3
                  </h4>
                  {classifiche[ministero.categoria]?.length > 0 ? (
                    <div className="space-y-1">
                      {classifiche[ministero.categoria].map((candidato, index) => (
                        <div key={candidato.nome} className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-yellow-600">#{index + 1}</span>
                            <span className="truncate">{candidato.nome}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {candidato.voti} voti
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nessun voto ancora</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}