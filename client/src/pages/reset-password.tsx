import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/api-config";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setError("");
    setResetUrl("");
    setLoading(true);
    
    try {
      const response = await fetch(getApiUrl('/auth/forgot-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Email di reset inviata! Controlla la tua casella di posta.");
        // Per test, mostriamo anche l'URL di reset
        if (data.resetUrl) {
          setResetUrl(data.resetUrl);
        }
      } else {
        setError(data.error || "Errore durante l'invio dell'email di reset.");
      }
    } catch (err: any) {
      setError("Errore di connessione. Riprova più tardi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Recupera password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block font-medium">Email</label>
            <Input
              type="email"
              placeholder="Inserisci la tua email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Invio in corso..." : "Invia link di reset"}
            </Button>
            {success && <div className="text-green-600 text-sm mt-2">{success}</div>}
            {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
            {resetUrl && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Test Mode:</strong> Clicca sul link per testare il reset password:
                </p>
                <a 
                  href={resetUrl} 
                  className="text-blue-600 hover:text-blue-800 underline break-all"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {resetUrl}
                </a>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 
