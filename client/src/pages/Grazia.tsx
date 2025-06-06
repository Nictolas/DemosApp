import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Scale, FileText, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Grazia() {
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

  const domande = [
    {
      id: "GR001",
      richiedente: "Mario Rossi",
      reato: "Furto aggravato",
      dataRichiesta: "15/12/2024",
      stato: "In valutazione",
      urgenza: "Media"
    },
    {
      id: "GR002",
      richiedente: "Anna Bianchi",
      reato: "Truffa",
      dataRichiesta: "10/12/2024",
      stato: "Approvata",
      urgenza: "Bassa"
    },
    {
      id: "GR003",
      richiedente: "Giuseppe Verdi",
      reato: "Evasione fiscale",
      dataRichiesta: "08/12/2024",
      stato: "Respinta",
      urgenza: "Alta"
    }
  ];

  const getStatusIcon = (stato: string) => {
    switch (stato) {
      case "Approvata":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "Respinta":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "In valutazione":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (stato: string) => {
    switch (stato) {
      case "Approvata":
        return <Badge className="bg-green-100 text-green-800">Approvata</Badge>;
      case "Respinta":
        return <Badge variant="destructive">Respinta</Badge>;
      case "In valutazione":
        return <Badge variant="secondary">In valutazione</Badge>;
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
              <div className="p-4 bg-gradient-to-r from-green-500 to-green-700 rounded-full">
                <Scale className="h-12 w-12 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
              Grazia
            </CardTitle>
            <CardDescription className="text-lg">
              Gestione delle domande di grazia e clemenza
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Statistiche */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Statistiche</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Totale domande:</span>
                  <span className="font-semibold">3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">In valutazione:</span>
                  <span className="font-semibold text-yellow-600">1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Approvate:</span>
                  <span className="font-semibold text-green-600">1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Respinte:</span>
                  <span className="font-semibold text-red-600">1</span>
                </div>
              </CardContent>
            </Card>

            {/* Nuova Domanda */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Nuova Domanda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="richiedente">Nome Richiedente</Label>
                  <Input id="richiedente" placeholder="Inserisci nome..." />
                </div>
                <div>
                  <Label htmlFor="reato">Reato</Label>
                  <Input id="reato" placeholder="Descrivi il reato..." />
                </div>
                <div>
                  <Label htmlFor="urgenza">Urgenza</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona urgenza" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bassa">Bassa</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="motivazione">Motivazione</Label>
                  <Textarea id="motivazione" placeholder="Inserisci motivazione..." rows={3} />
                </div>
                <Button className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  Invia Domanda
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Lista Domande */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Domande di Grazia</CardTitle>
                  <div className="w-64">
                    <Input
                      placeholder="Cerca per nome o ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {domande.map((domanda) => (
                    <Card key={domanda.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-lg">{domanda.richiedente}</span>
                              <Badge variant="outline">ID: {domanda.id}</Badge>
                            </div>
                            <p className="text-muted-foreground">
                              <strong>Reato:</strong> {domanda.reato}
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <span>Data: {domanda.dataRichiesta}</span>
                              <span>Urgenza: {domanda.urgenza}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end space-y-2">
                            {getStatusBadge(domanda.stato)}
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(domanda.stato)}
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2 mt-4">
                          <Button size="sm" variant="outline">
                            <FileText className="mr-1 h-3 w-3" />
                            Dettagli
                          </Button>
                          {domanda.stato === "In valutazione" && (
                            <>
                              <Button size="sm" variant="default">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Approva
                              </Button>
                              <Button size="sm" variant="destructive">
                                <XCircle className="mr-1 h-3 w-3" />
                                Respingi
                              </Button>
                            </>
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