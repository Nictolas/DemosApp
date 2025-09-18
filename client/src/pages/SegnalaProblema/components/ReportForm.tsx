import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email: string;
  nome?: string;
  cognome?: string;
}

interface ReportFormProps {
  user: User;
}

interface ReportData {
  type: string;
  title: string;
  description: string;
  priority: string;
  steps: string;
  expected: string;
  actual: string;
  browser: string;
  device: string;
}

export const ReportForm: React.FC<ReportFormProps> = ({ user }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState<ReportData>({
    type: "",
    title: "",
    description: "",
    priority: "medium",
    steps: "",
    expected: "",
    actual: "",
    browser: "",
    device: ""
  });

  const handleInputChange = (field: keyof ReportData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Invia la segnalazione al backend
      const response = await fetch('/api/segnalazioni', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          userId: user.id,
          userEmail: user.email
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nell\'invio della segnalazione');
      }

      console.log("Segnalazione inviata:", result);

      setIsSubmitted(true);
      toast({
        title: "Segnalazione inviata!",
        description: `Grazie per il tuo feedback. La segnalazione è stata inviata a ${result.adminCount} amministratori.`,
        variant: "default",
      });
    } catch (error) {
      console.error('Errore invio segnalazione:', error);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante l'invio. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-green-50 via-white to-emerald-50 backdrop-blur-sm">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/20 to-emerald-500/20 rounded-full -translate-y-16 translate-x-16"></div>
        
        <CardHeader className="relative text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-green-800">
            Segnalazione Inviata!
          </CardTitle>
          <CardDescription className="text-green-600 text-lg">
            Grazie per il tuo feedback. Il nostro team analizzerà il problema e ti contatterà se necessario.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="relative text-center">
          <Button 
            onClick={() => {
              setIsSubmitted(false);
              setFormData({
                type: "",
                title: "",
                description: "",
                priority: "medium",
                steps: "",
                expected: "",
                actual: "",
                browser: "",
                device: ""
              });
            }}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Invia un'altra segnalazione
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-white via-orange-50/30 to-yellow-50/50 backdrop-blur-sm">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-400/20 to-yellow-500/20 rounded-full -translate-y-16 translate-x-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-red-400/20 to-orange-500/20 rounded-full translate-y-12 -translate-x-12"></div>
      
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-3 text-2xl font-bold">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-600 flex items-center justify-center shadow-lg">
            <AlertCircle className="h-5 w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Form Segnalazione
          </span>
        </CardTitle>
        <CardDescription className="text-gray-600 text-base">
          Compila tutti i campi per aiutarci a risolvere il problema
        </CardDescription>
      </CardHeader>
      
      <CardContent className="relative">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo di segnalazione */}
          <div className="space-y-2">
            <Label htmlFor="type" className="text-sm font-semibold text-gray-700">
              Tipo di segnalazione *
            </Label>
            <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
              <SelectTrigger className="w-full rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20">
                <SelectValue placeholder="Seleziona il tipo di problema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">🐛 Bug / Malfunzionamento</SelectItem>
                <SelectItem value="feature">💡 Suggerimento / Nuova funzionalità</SelectItem>
                <SelectItem value="ui">🎨 Problema di interfaccia</SelectItem>
                <SelectItem value="performance">⚡ Problema di prestazioni</SelectItem>
                <SelectItem value="security">🔒 Problema di sicurezza</SelectItem>
                <SelectItem value="other">❓ Altro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Titolo */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-semibold text-gray-700">
              Titolo del problema *
            </Label>
            <Input
              id="title"
              type="text"
              placeholder="Breve descrizione del problema"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
              className="w-full rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          {/* Descrizione dettagliata */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-semibold text-gray-700">
              Descrizione dettagliata *
            </Label>
            <Textarea
              id="description"
              placeholder="Descrivi il problema in dettaglio..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              required
              rows={4}
              className="w-full rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 resize-none"
            />
          </div>

          {/* Priorità */}
          <div className="space-y-2">
            <Label htmlFor="priority" className="text-sm font-semibold text-gray-700">
              Priorità
            </Label>
            <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
              <SelectTrigger className="w-full rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">🟢 Bassa - Non urgente</SelectItem>
                <SelectItem value="medium">🟡 Media - Normale</SelectItem>
                <SelectItem value="high">🟠 Alta - Importante</SelectItem>
                <SelectItem value="critical">🔴 Critica - Blocca l'uso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Passaggi per riprodurre */}
          <div className="space-y-2">
            <Label htmlFor="steps" className="text-sm font-semibold text-gray-700">
              Passaggi per riprodurre il problema
            </Label>
            <Textarea
              id="steps"
              placeholder="1. Vai alla pagina...&#10;2. Clicca su...&#10;3. Il problema si verifica quando..."
              value={formData.steps}
              onChange={(e) => handleInputChange('steps', e.target.value)}
              rows={3}
              className="w-full rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 resize-none"
            />
          </div>

          {/* Comportamento atteso vs effettivo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expected" className="text-sm font-semibold text-gray-700">
                Comportamento atteso
              </Label>
              <Textarea
                id="expected"
                placeholder="Cosa dovrebbe succedere..."
                value={formData.expected}
                onChange={(e) => handleInputChange('expected', e.target.value)}
                rows={2}
                className="w-full rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual" className="text-sm font-semibold text-gray-700">
                Comportamento effettivo
              </Label>
              <Textarea
                id="actual"
                placeholder="Cosa succede invece..."
                value={formData.actual}
                onChange={(e) => handleInputChange('actual', e.target.value)}
                rows={2}
                className="w-full rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 resize-none"
              />
            </div>
          </div>

          {/* Informazioni tecniche */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="browser" className="text-sm font-semibold text-gray-700">
                Browser utilizzato
              </Label>
              <Input
                id="browser"
                type="text"
                placeholder="es. Chrome 120, Firefox 119, Safari 17"
                value={formData.browser}
                onChange={(e) => handleInputChange('browser', e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="device" className="text-sm font-semibold text-gray-700">
                Dispositivo
              </Label>
              <Input
                id="device"
                type="text"
                placeholder="es. Desktop Windows, iPhone 15, Android Samsung"
                value={formData.device}
                onChange={(e) => handleInputChange('device', e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
          </div>

          {/* Pulsante di invio */}
          <div className="pt-4">
            <Button
              type="submit"
              disabled={isSubmitting || !formData.type || !formData.title || !formData.description}
              className="w-full h-14 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-600 hover:from-orange-600 hover:to-yellow-700 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Invio in corso...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Invia Segnalazione
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
