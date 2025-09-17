import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart } from "lucide-react";
import { Link } from "wouter";

export default function Dona() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 page-with-navbar">
      <div className="container mx-auto p-4 max-w-xl flex flex-col items-center justify-center">
        <Card className="mt-10 w-full">
          <CardHeader className="flex flex-col items-center">
            <Heart className="h-10 w-10 text-pink-500 mb-2" />
            <CardTitle className="text-2xl font-bold text-center">Sostieni DEMOS</CardTitle>
            <CardDescription className="text-center text-base mt-2 mb-4">
              <span className="block font-semibold text-lg mb-2">Unisciti a noi per rendere la democrazia più concreta e partecipativa:</span>
              <span className="block mb-2">L’app <strong>Demos</strong> nasce per abbattere le distanze tra cittadini e istituzioni, dando a ognuno voce nel dibattito pubblico e nelle decisioni che contano.<br/>Ogni funzione è pensata per semplificare la partecipazione: proposte, votazioni, dibattiti in tempo reale, trasparenza assoluta.</span>
              <span className="block font-semibold mt-4 mb-2">Con il tuo contributo possiamo:</span>
              <ul className="list-disc list-inside text-left mb-2">
                <li>Espandere Demos in nuove lingue e Paesi, portando la democrazia diretta ovunque.</li>
                <li>Migliorare sicurezza e accessibilità, perché ogni cittadino abbia pari opportunità.</li>
                <li>Creare campagne di sensibilizzazione per formare attivisti digitali e far crescere una comunità globale.</li>
              </ul>
              <span className="block mb-2">Sostieni Demos oggi: <strong>la tua donazione è un investimento nella democrazia partecipativa mondiale</strong>.<br/>Aiutaci a costruire un futuro in cui le idee di tutti contino davvero.</span>
              <span className="block font-bold text-lg text-pink-600 mt-4">👉 Dona ora e diventa protagonista del cambiamento.</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <a href="https://www.paypal.com/donate" target="_blank" rel="noopener noreferrer">
              <Button variant="default" className="w-full">Dona con PayPal</Button>
            </a>
            <Link href="/impostazioni">
              <Button variant="outline" className="w-full flex items-center justify-center">
                <ArrowLeft className="mr-2 h-4 w-4" /> Torna alle Impostazioni
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
