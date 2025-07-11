import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Scale } from "lucide-react";

interface Classifica { nome: string; voti: number; }

export default function Grazia() {
  const [classifica, setClassifica] = useState<Classifica[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClassifica() {
      setLoading(true);
      const colRef = collection(db, "voti_grazia");
      const snapshot = await getDocs(colRef);
      const votiList = snapshot.docs.map(doc => doc.data().nome);
      // Conta i voti per ogni nome
      const conteggio: Record<string, number> = {};
      votiList.forEach((nome: string) => {
        if (nome) conteggio[nome] = (conteggio[nome] || 0) + 1;
      });
      // Trasforma in array ordinato per numero di voti
      const classificaArray: Classifica[] = Object.entries(conteggio)
        .map(([nome, voti]) => ({ nome, voti: Number(voti) }))
        .sort((a, b) => b.voti - a.voti);
      setClassifica(classificaArray);
      setLoading(false);
    }
    fetchClassifica();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-4xl">
        <Link href="/menu">
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
          </Button>
        </Link>

        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-green-500 to-green-700 rounded-full"><Scale className="h-12 w-12 text-white" /></div></div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">Grazia</CardTitle>
            <CardDescription className="text-lg">Classifica dei carcerati che hanno ricevuto più richieste di grazia.</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2"><Scale className="h-5 w-5" /><span>Classifica Grazia</span></CardTitle>
            <CardDescription>Vedi chi ha ricevuto più voti per la grazia.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : classifica.length === 0 ? (
              <div className="text-gray-500">Nessun voto trovato.</div>
            ) : (
              <ul className="space-y-2">
                {classifica.map(item => (
                  <li key={item.nome} className="border rounded p-3 bg-white shadow flex justify-between">
                    <span>{item.nome}</span>
                    <span className="font-bold">{item.voti} voto{item.voti > 1 ? "i" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}