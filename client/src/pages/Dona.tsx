import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart } from "lucide-react";
import { Link } from "wouter";

export default function Dona() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navbar />
      <div className="container mx-auto p-4 max-w-xl flex flex-col items-center justify-center">
        <Card className="mt-10 w-full">
          <CardHeader className="flex flex-col items-center">
            <Heart className="h-10 w-10 text-pink-500 mb-2" />
            <CardTitle className="text-2xl font-bold text-center">Sostieni DEMOS</CardTitle>
            <CardDescription className="text-center">Il tuo contributo aiuta a mantenere la piattaforma gratuita e indipendente. Grazie di cuore!</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <a href="https://www.paypal.com/donate" target="_blank" rel="noopener noreferrer">
              <Button variant="default" className="w-full">Dona con PayPal</Button>
            </a>
            {/* Puoi aggiungere altri metodi di donazione qui */}
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