import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Building2, User, Users, Scale, Shield, Banknote, Briefcase, GraduationCap, Heart, Palette, Vote, Trophy, Leaf, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuthReady } from "@/hooks/use-auth-ready";

interface Classifica {
  nome: string;
  voti: number;
}

interface UserVoti {
  [categoria: string]: string;
}

interface TutteClassifiche {
  [categoria: string]: Classifica[];
}

export default function Governo() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userVoti, setUserVoti] = useState<UserVoti>({});
  const [classifiche, setClassifiche] = useState<TutteClassifiche>({});
  const [loadingVoti, setLoadingVoti] = useState(false);
  const [votingCategory, setVotingCategory] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const ministeri = [
    {
      title: "Primo Ministro",
      categoria: "primo_ministro",
      icon: User,
      description: "Presidenza del Consiglio dei Ministri",
      color: "bg-red-100 text-red-600"
    },
    {
      title: "Ministro degli Esteri",
      categoria: "esteri",
      icon: Building2,
      description: "Relazioni internazionali e cooperazione",
      color: "bg-blue-100 text-blue-600"
    },
    {
      title: "Ministro dell'Interno",
      categoria: "interno",
      icon: Shield,
      description: "Sicurezza pubblica e amministrazione territoriale",
      color: "bg-green-100 text-green-600"
    },
    {
      title: "Ministro della Giustizia",
      categoria: "giustizia",
      icon: Scale,
      description: "Sistema giudiziario e carcerario",
      color: "bg-purple-100 text-purple-600"
    },
    {
      title: "Ministro della Difesa",
      categoria: "difesa",
      icon: Shield,
      description: "Forze armate e sicurezza nazionale",
      color: "bg-gray-100 text-gray-600"
    },
    {
      title: "Ministro dell'Economia e delle Finanze",
      categoria: "economia",
      icon: Banknote,
      description: "Politiche economiche e fiscali",
      color: "bg-yellow-100 text-yellow-600"
    },
    {
      title: "Ministro del Lavoro e delle Politiche Sociali",
      categoria: "lavoro",
      icon: Briefcase,
      description: "Occupazione e previdenza sociale",
      color: "bg-orange-100 text-orange-600"
    },
    {
      title: "Ministro dell'Istruzione",
      categoria: "istruzione",
      icon: GraduationCap,
      description: "Sistema educativo e formazione",
      color: "bg-indigo-100 text-indigo-600"
    },
    {
      title: "Ministro della Salute",
      categoria: "salute",
      icon: Heart,
      description: "Sanità pubblica e politiche sanitarie",
      color: "bg-pink-100 text-pink-600"
    },
    {
      title: "Ministro della Cultura",
      categoria: "cultura",
      icon: Palette,
      description: "Patrimonio culturale e spettacolo",
      color: "bg-teal-100 text-teal-600"
    },
    {
      title: "Ministro dell'Ambiente della Sicurezza Energetica",
      categoria: "ambiente_sicurezza_energetica",
      icon: Leaf,
      description: "Tutela dell'ambiente e sicurezza energetica",
      color: "bg-lime-100 text-lime-600"
    }
  ];

  const CATEGORIE_VALIDE = [
    "primo_ministro",
    "esteri",
    "interno",
    "giustizia",
    "difesa",
    "economia",
    "lavoro",
    "istruzione",
    "salute",
    "cultura",
    "ambiente_sicurezza_energetica"
  ];

  // Carica i voti dell'utente e le classifiche
  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetch(`/api/users/${encodeURIComponent(user.uid)}`)
        .then(res => res.json())
        .then(data => setIsAdmin(data?.ruolo === 'Admin'));
    }
  }, [user]);

  const loadUserData = async () => {
    setLoadingVoti(true);
    try {
      // Carica i voti dell'utente
      const votiResponse = await apiRequest("GET", "/api/governo/voti");
      if (votiResponse.ok) {
        const voti = votiResponse.data;
        setUserVoti(voti);
      }

      // Carica tutte le classifiche
      const classificheResponse = await apiRequest("GET", "/api/governo/classifica");
      if (classificheResponse.ok) {
        const classificheData = classificheResponse.data;
        setClassifiche(classificheData);
      }
    } catch (error) {
      console.error('Errore nel caricamento dati:', error);
    } finally {
      setLoadingVoti(false);
    }
  };

  const handleVote = async (categoria: string, nomeMinistro: string) => {
    console.log('DEBUG handleVote', { categoria, nomeMinistro });
    if (!nomeMinistro.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci un nome valido",
        variant: "destructive",
      });
      return;
    }
    if (!CATEGORIE_VALIDE.includes(categoria)) {
      toast({
        title: "Errore categoria",
        description: `Categoria non valida: ${categoria}`,
        variant: "destructive",
      });
      console.error('Categoria non valida in handleVote:', categoria, nomeMinistro);
      return;
    }
    setVotingCategory(categoria);
    try {
      const response = await apiRequest("POST", "/api/governo/vota", {
        categoria,
        nome: nomeMinistro.trim()
      });

      if (response.ok) {
        toast({
          title: "Voto registrato",
          description: `Hai votato ${nomeMinistro} per ${ministeri.find(m => m.categoria === categoria)?.title}`,
        });
        
        // Aggiorna i dati
        await loadUserData();
      } else {
        const error = response.data;
        toast({
          title: "Errore",
          description: error.error || "Errore nel registrare il voto",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Errore nel votare:', error);
      toast({
        title: "Errore",
        description: "Errore di connessione",
        variant: "destructive",
      });
    } finally {
      setVotingCategory(null);
    }
  };

  if (!authReady || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
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

        {loadingVoti ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ministeri.map((ministero) => {
              console.log('DEBUG MINISTERO:', ministero);
              return (
                <MinisteroCard
                  key={ministero.categoria}
                  ministero={ministero}
                  userVote={userVoti[ministero.categoria] || ""}
                  classifica={classifiche[ministero.categoria] || []}
                  onVote={(nome) => handleVote(ministero.categoria, nome)}
                  isVoting={votingCategory === ministero.categoria}
                  toast={toast}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface MinisteroCardProps {
  ministero: {
    title: string;
    categoria: string;
    icon: any;
    description: string;
    color: string;
  };
  userVote: string;
  classifica: Classifica[];
  onVote: (nome: string) => void;
  isVoting: boolean;
  toast: any;
}

function MinisteroCard({ ministero, userVote, classifica, onVote, isVoting, toast }: MinisteroCardProps) {
  const { user } = useAuth();
  const [nomeInput, setNomeInput] = useState(userVote);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setNomeInput(userVote);
  }, [userVote]);

  useEffect(() => {
    if (user) {
      fetch(`/api/users/${encodeURIComponent(user.uid)}`)
        .then(res => res.json())
        .then(data => setIsAdmin(data?.ruolo === 'Admin'));
    }
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onVote(nomeInput);
  };

  const handleDelete = async (nome: string) => {
    if (!window.confirm(`Sei sicuro di voler cancellare ${nome}?`)) return;
    try {
      const res = await apiRequest("DELETE", `/api/governo/classifica/${ministero.categoria}/${encodeURIComponent(nome)}`);
      if (res.ok) {
        window.location.reload();
      } else {
        toast({ title: 'Errore', description: 'Impossibile cancellare il candidato', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Errore', description: 'Errore di rete', variant: 'destructive' });
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <div className={`p-3 rounded-lg ${ministero.color}`}>
            <ministero.icon className="h-6 w-6" />
          </div>
          {userVote && (
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
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex space-x-2">
            <Input
              placeholder="Nome del candidato..."
              value={nomeInput}
              onChange={(e) => setNomeInput(e.target.value)}
              className="flex-1"
            />
            <Button 
              type="submit" 
              size="sm" 
              disabled={isVoting || !nomeInput.trim()}
            >
              {isVoting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Vote className="h-4 w-4" />
              )}
            </Button>
          </div>
          {userVote && (
            <p className="text-xs text-muted-foreground">
              Il tuo voto attuale: <strong>{userVote}</strong>
            </p>
          )}
        </form>

        {/* Classifica */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center">
            <Trophy className="h-4 w-4 mr-1 text-yellow-500" />
            Top 3
          </h4>
          {classifica.length > 0 ? (
            <div className="space-y-1">
              {classifica.map((candidato, index) => (
                <div key={candidato.nome} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-yellow-600">#{index + 1}</span>
                    <span className="truncate">{candidato.nome}</span>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(candidato.nome)}
                        className="ml-2 text-red-600 hover:text-red-800"
                        title="Elimina candidato"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
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
  );
}