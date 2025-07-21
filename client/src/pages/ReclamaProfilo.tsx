import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Shield, Upload, FileText, CheckCircle, Crown, BarChart3, MessageCircle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

interface PremiumBenefit {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface AccountType {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  color: string;
  popular?: boolean;
}

const premiumBenefits: PremiumBenefit[] = [
  {
    icon: <Crown className="h-5 w-5 text-yellow-500" />,
    title: "Badge verificato",
    description: "Riconoscimento ufficiale del tuo ruolo istituzionale"
  },
  {
    icon: <BarChart3 className="h-5 w-5 text-blue-500" />,
    title: "Dashboard elettorale",
    description: "Analisi e report costanti delle preferenze in tempo reale"
  },
  {
    icon: <MessageCircle className="h-5 w-5 text-green-500" />,
    title: "Canale diretto",
    description: "Notifiche push e comunicazioni personalizzate ai tuoi sostenitori"
  },
  {
    icon: <Users className="h-5 w-5 text-purple-500" />,
    title: "Strumenti di engagement",
    description: "Statistiche e sondaggi per coinvolgere il tuo elettorato"
  }
];

const accountTypes: AccountType[] = [
  {
    name: "Demos Voter",
    price: "Gratuito",
    period: "per sempre",
    description: "Per chi: Gli elettori e i cittadini che vogliono interagire con la politica",
    features: [
      "Esprimere le proprie opinioni su temi importanti",
      "Trovare rappresentanti e candidati con ideologie compatibili",
      "Votare simbolicamente per capo di stato, amnistia, grazia e governo ideale",
      "Ricevere aggiornamenti costanti sulle votazioni"
    ],
    color: "blue"
  },
  {
    name: "Demos Candidate",
    price: "30 €",
    period: "all'anno",
    description: "Per chi: I candidati che aspirano a una carica politica",
    features: [
      "Creare e gestire il proprio profilo pubblico di candidato",
      "Interagire con gli elettori e costruire una base di sostenitori",
      "Accesso a strumenti base per l'engagement e l'analisi",
      "In caso di vittoria: passaggio a Demos Rep gratuito per il primo anno!"
    ],
    color: "green"
  },
  {
    name: "Demos Rep",
    price: "50 €",
    period: "all'anno",
    description: "Per chi: I rappresentanti eletti e i politici in carica",
    features: [
      "Badge Verificato: Riconoscimento ufficiale del ruolo istituzionale",
      "Dashboard Elettorale: Analisi e report delle preferenze in tempo reale",
      "Canale Diretto: Notifiche push e comunicazioni personalizzate",
      "Strumenti di Engagement: Statistiche e sondaggi avanzati",
      "Gestione avanzata del profilo e delle comunicazioni"
    ],
    color: "purple",
    popular: true
  },
  {
    name: "Demos Plus",
    price: "69 €",
    period: "all'anno",
    description: "Per chi: Politici già eletti che si preparano alle prossime elezioni",
    features: [
      "Include tutte le funzionalità di Demos Candidate e Demos Rep",
      "Accesso prioritario a nuove funzionalità e supporto dedicato",
      "Strumenti avanzati di analisi e strategia elettorale",
      "Massima visibilità e coinvolgimento con l'elettorato"
    ],
    color: "orange"
  }
];

export default function ReclamaProfilo() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [currentPhase, setCurrentPhase] = useState<"search" | "form" | "success">("search");
  const [isSearching, setIsSearching] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    nome: "",
    cognome: "",
    carica_attuale: "",
    ente_elettorale: "",
    email: "",
    riferimento_istituzionale: "",
    gdpr_accepted: false
  });
  
  const [documents, setDocuments] = useState({
    documento_identita: null as File | null,
    certificazione_elezione: null as File | null,
    dichiarazione_carica: null as File | null
  });

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-secondary/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Search for profiles
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci un nome per la ricerca",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/search-politicians?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data.length === 0) {
        setSearchResults([]);
        toast({
          title: "Profilo non trovato",
          description: "Questo profilo non è presente su DEMOS.",
          variant: "destructive"
        });
      } else {
        setSearchResults(data);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Errore di ricerca",
        description: "Si è verificato un errore durante la ricerca",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Handle profile claim
  const handleClaimProfile = (profile: any) => {
    setSelectedProfile(profile);
    setFormData(prev => ({
      ...prev,
      nome: profile.nome || "",
      cognome: profile.cognome || ""
    }));
    setCurrentPhase("form");
  };

  // Handle form input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle file uploads
  const handleFileUpload = (field: keyof typeof documents, file: File | null) => {
    setDocuments(prev => ({
      ...prev,
      [field]: file
    }));
  };

  // Submit claim request
  const submitClaimMutation = useMutation({
    mutationFn: async (claimData: any) => {
      const formDataToSend = new FormData();
      
      // Add form fields
      Object.keys(formData).forEach(key => {
        if (key !== 'gdpr_accepted') {
          formDataToSend.append(key, formData[key as keyof typeof formData] as string);
        }
      });
      
      // Add selected profile info
      if (selectedProfile) {
        formDataToSend.append('profile_id', selectedProfile.id);
      }
      
      // Add documents
      Object.entries(documents).forEach(([key, file]) => {
        if (file) {
          formDataToSend.append(key, file);
        }
      });

      const response = await fetch('/api/claim-profile', {
        method: 'POST',
        body: formDataToSend
      });

      if (!response.ok) {
        throw new Error('Failed to submit claim request');
      }

      return response.json();
    },
    onSuccess: () => {
      setCurrentPhase("success");
      toast({
        title: "Richiesta inviata!",
        description: "Riceverai una notifica non appena verificato.",
      });
    },
    onError: (error) => {
      console.error("Claim submission error:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'invio della richiesta",
        variant: "destructive"
      });
    }
  });

  const handleSubmitClaim = () => {
    // Validation
    if (!formData.nome || !formData.cognome || !formData.carica_attuale || 
        !formData.ente_elettorale || !formData.email || !formData.gdpr_accepted) {
      toast({
        title: "Campi obbligatori mancanti",
        description: "Compila tutti i campi obbligatori e accetta i termini",
        variant: "destructive"
      });
      return;
    }

    if (!documents.documento_identita || !documents.certificazione_elezione || 
        !documents.dichiarazione_carica) {
      toast({
        title: "Documenti mancanti",
        description: "Carica tutti i documenti richiesti",
        variant: "destructive"
      });
      return;
    }

    submitClaimMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto p-4 max-w-6xl">
        
        {/* Header */}
        <Card className="mt-6 mb-8">
          <CardHeader>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              Reclama Profilo
            </CardTitle>
            <CardDescription className="text-lg">
              Sei un rappresentante eletto? Verifica subito se il tuo profilo esiste e richiedi il 'badge verificato' per accedere a DEMOS Premium!
            </CardDescription>
          </CardHeader>
        </Card>

        {currentPhase === "search" && (
          <>
            {/* Phase 1: Search Profile */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Fase 1 - Cerca il tuo profilo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Inserisci il tuo nome e cognome..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Cerca
                  </Button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Profili trovati:</h4>
                    {searchResults.map((profile, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h5 className="font-medium">{profile.nome} {profile.cognome}</h5>
                            <p className="text-sm text-muted-foreground">
                              {profile.ruolo} - {profile.comune_elezione}, {profile.regione_elezione}
                            </p>
                          </div>
                          <Button onClick={() => handleClaimProfile(profile)}>
                            Reclama questo profilo
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Create New Profile Option */}
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    Non hai trovato il tuo profilo?
                  </p>
                  <Button variant="outline" onClick={() => setCurrentPhase("form")}>
                    Crea un nuovo profilo da reclamare
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {currentPhase === "form" && (
          <>
            {/* Phase 2: Form */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Fase 2 - Compila i dati
                </CardTitle>
                {selectedProfile && (
                  <CardDescription>
                    Stai reclamando il profilo di: <strong>{selectedProfile.nome} {selectedProfile.cognome}</strong>
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Personal Info */}
                <div className="space-y-4">
                  <h4 className="font-medium">Dati Personali</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome">Nome *</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => handleInputChange("nome", e.target.value)}
                        placeholder="Il tuo nome"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cognome">Cognome *</Label>
                      <Input
                        id="cognome"
                        value={formData.cognome}
                        onChange={(e) => handleInputChange("cognome", e.target.value)}
                        placeholder="Il tuo cognome"
                      />
                    </div>
                  </div>
                </div>

                {/* Professional Info */}
                <div className="space-y-4">
                  <h4 className="font-medium">Informazioni Professionali</h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="carica_attuale">Carica Attuale *</Label>
                      <Input
                        id="carica_attuale"
                        value={formData.carica_attuale}
                        onChange={(e) => handleInputChange("carica_attuale", e.target.value)}
                        placeholder="es. Sindaco, Consigliere Regionale, Deputato"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ente_elettorale">Ente Elettorale *</Label>
                      <Input
                        id="ente_elettorale"
                        value={formData.ente_elettorale}
                        onChange={(e) => handleInputChange("ente_elettorale", e.target.value)}
                        placeholder="es. Comune di Roma, Regione Lazio, Parlamento"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Recapito E-mail *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        placeholder="Il tuo indirizzo email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="riferimento_istituzionale">Riferimento Istituzionale</Label>
                      <Textarea
                        id="riferimento_istituzionale"
                        value={formData.riferimento_istituzionale}
                        onChange={(e) => handleInputChange("riferimento_istituzionale", e.target.value)}
                        placeholder="Link al sito ufficiale o contatto dell'ufficio elettorale"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {/* Document Upload */}
                <div className="space-y-4">
                  <h4 className="font-medium">Upload Documenti *</h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="documento_identita">Documento di identità ufficiale *</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Carta d'identità o passaporto in corso di validità (fronte/retro)
                      </p>
                      <Input
                        id="documento_identita"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload("documento_identita", e.target.files?.[0] || null)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="certificazione_elezione">Certificazione di elezione *</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Copia del verbale di proclamazione o estratto ufficiale
                      </p>
                      <Input
                        id="certificazione_elezione"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload("certificazione_elezione", e.target.files?.[0] || null)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dichiarazione_carica">Dichiarazione di carica *</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Autocertificazione su carta semplice con carica attuale e data di inizio mandato
                      </p>
                      <Input
                        id="dichiarazione_carica"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload("dichiarazione_carica", e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                </div>

                {/* GDPR Checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="gdpr"
                    checked={formData.gdpr_accepted}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, gdpr_accepted: !!checked }))
                    }
                  />
                  <Label htmlFor="gdpr" className="text-sm">
                    Accetto i termini, le condizioni e la{" "}
                    <a href="/privacy-policy" className="text-primary hover:underline">
                      Privacy Policy di Demos
                    </a>
                    *
                  </Label>
                </div>

                {/* Submit Button */}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentPhase("search")}
                  >
                    Indietro
                  </Button>
                  <Button 
                    onClick={handleSubmitClaim}
                    disabled={submitClaimMutation.isPending}
                    className="flex-1"
                  >
                    {submitClaimMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Invia richiesta
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {currentPhase === "success" && (
          <>
            {/* Phase 3: Success */}
            <Card className="mb-8 text-center">
              <CardContent className="p-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-green-700 mb-2">Richiesta inviata!</h3>
                <p className="text-lg text-muted-foreground mb-4">
                  Riceverai una notifica non appena verificato.
                </p>
                <Button onClick={() => setCurrentPhase("search")}>
                  Invia un'altra richiesta
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {/* Premium Benefits Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Benefits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold">
                Vantaggi di DEMOS Premium
              </CardTitle>
              <CardDescription>
                Con soli 50 € all'anno, DEMOS Premium ti offre:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {premiumBenefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    {benefit.icon}
                    <div>
                      <h4 className="font-medium">{benefit.title}</h4>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Account Types Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold">
                Scegli il Tuo Account DEMOS
              </CardTitle>
              <CardDescription>
                Diversi piani per diverse esigenze politiche
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {accountTypes.slice(0, 2).map((account, index) => (
                  <div key={index} className={`p-3 border rounded-lg ${account.popular ? 'border-primary bg-primary/5' : ''}`}>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">{account.name}</h4>
                      <span className="text-sm font-bold text-primary">
                        {account.price} {account.period !== "per sempre" && `/${account.period}`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{account.description}</p>
                  </div>
                ))}
                <Button variant="outline" className="w-full">
                  Visualizza tutti i piani
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}