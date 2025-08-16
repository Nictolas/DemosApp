import { useState } from "react";
// Firebase rimosso - reset password via API
// import { sendPasswordResetEmail } from "@/lib/firebase-stub";
// import { auth } from "@/lib/firebase-stub";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess("Email di reset inviata! Controlla la tua casella di posta.");
    } catch (err: any) {
      setError(err.message || "Errore durante l'invio dell'email di reset.");
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 