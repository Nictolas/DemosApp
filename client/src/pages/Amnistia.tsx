import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Users, FileText, Calendar, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Amnistia() {
  const { user, isLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  const provvedimenti = [
    {
      id: "AM001",
      titolo: "Amnistia per reati minori",
      categoria: "Reati contro il patrimonio",
      dataCreazione: "01/12/2024",
      stato: "Attiva",
      beneficiari: 1250,
      scadenza: "31/12/2025"
    },
    {
      id: "AM002", 
      titolo: "Condono per infrazioni fiscali",
      categoria: "Reati tributari",
      dataCreazione: "15/11/2024",
      stato: "In discussione",
      beneficiari: 0,
      scadenza: "30/06/2025"
    },
    {
      id: "AM003",
      titolo: "Amnistia traffico stradale",
      categoria: "Codice della strada",
      dataCreazione: "10/10/2024",
      stato: "Scaduta",
      beneficiari: 3420,
      scadenza: "10/11/2024"
    }
  ];

  const getStatusIcon = (stato: string) => {
    switch (stato) {
      case "Attiva":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "Scaduta":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "In discussione":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (stato: string) => {
    switch (stato) {
      case "Attiva":
        return <Badge className="bg-green-100 text-green-800">Attiva</Badge>;
      case "Scaduta":
        return <Badge variant="destructive">Scaduta</Badge>;
      case "In discussione":
        return <Badge variant="secondary">In discussione</Badge>;
      default:
        return <Badge variant="outline">Sconosciuto</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-6xl">
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
              <div className="p-4 bg-gradient-to-r from-purple-500 to-purple-700 rounded-full">
                <Users className="h-12 w-12 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
              Amnistia
            </CardTitle>
            <CardDescription className="text-lg">
              Gestione dei provvedimenti di amnistia e indulto
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Statistiche e Nuovo Provvedimento */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Statistiche Generali</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Provvedimenti attivi:</span>
                  <span className="font-semibold text-green-600">1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">In discussione:</span>
                  <span className="font-semibold text-yellow-600">1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Beneficiari totali:</span>
                  <span className="font-semibold">4,670</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Scaduti:</span>
                  <span className="font-semibold text-red-600">1</span>
                </div>
              </CardContent>
            </Card>

            {/* Nuovo Provvedimento */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Nuovo Provvedimento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="titolo">Titolo</Label>
                  <Input id="titolo" placeholder="Titolo del provvedimento..." />
                </div>
                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patrimonio">Reati contro il patrimonio</SelectItem>
                      <SelectItem value="tributari">Reati tributari</SelectItem>
                      <SelectItem value="stradale">Codice della strada</SelectItem>
                      <SelectItem value="amministrativi">Reati amministrativi</SelectItem>
                      <SelectItem value="altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="scadenza">Data Scadenza</Label>
                  <Input id="scadenza" type="date" />
                </div>
                <div>
                  <Label htmlFor="descrizione">Descrizione</Label>
                  <Textarea id="descrizione" placeholder="Descrizione del provvedimento..." rows={3} />
                </div>
                <Button className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  Crea Provvedimento
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Lista Provvedimenti */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Provvedimenti di Amnistia</CardTitle>
                  <div className="w-64">
                    <Input
                      placeholder="Cerca per titolo o ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {provvedimenti.map((provvedimento) => (
                    <Card key={provvedimento.id} className="border-l-4 border-l-purple-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-lg">{provvedimento.titolo}</span>
                              <Badge variant="outline">ID: {provvedimento.id}</Badge>
                            </div>
                            <p className="text-muted-foreground">
                              <strong>Categoria:</strong> {provvedimento.categoria}
                            </p>
                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                              <div>
                                <span className="flex items-center space-x-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>Creato: {provvedimento.dataCreazione}</span>
                                </span>
                              </div>
                              <div>
                                <span className="flex items-center space-x-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>Scadenza: {provvedimento.scadenza}</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-sm">
                              <span className="flex items-center space-x-1">
                                <Users className="h-3 w-3" />
                                <span>{provvedimento.beneficiari.toLocaleString()} beneficiari</span>
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end space-y-2">
                            {getStatusBadge(provvedimento.stato)}
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(provvedimento.stato)}
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2 mt-4">
                          <Button size="sm" variant="outline">
                            <FileText className="mr-1 h-3 w-3" />
                            Dettagli
                          </Button>
                          {provvedimento.stato === "In discussione" && (
                            <>
                              <Button size="sm" variant="default">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Attiva
                              </Button>
                              <Button size="sm" variant="destructive">
                                <XCircle className="mr-1 h-3 w-3" />
                                Respingi
                              </Button>
                            </>
                          )}
                          {provvedimento.stato === "Attiva" && (
                            <Button size="sm" variant="secondary">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Sospendi
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}