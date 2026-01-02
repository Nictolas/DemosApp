import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Scale, Sparkles } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <>
      <Link href="/vota">
        <Button variant="ghost" className="mb-6 flex items-center hover:bg-gray-100 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna a Vota
        </Button>
      </Link>
      
      <Card className="mb-8 border-0 shadow-xl bg-gradient-to-br from-white via-green-50/30 to-emerald-50/40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-100/20 via-transparent to-emerald-100/20 pointer-events-none" />
        <CardHeader className="text-center relative z-10 pb-6">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-600 rounded-full blur-xl opacity-50 animate-pulse" />
              <div className="relative p-5 bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 rounded-full shadow-2xl transform hover:scale-105 transition-transform duration-300">
                <Scale className="h-14 w-14 text-white" />
              </div>
              <div className="absolute -top-1 -right-1">
                <Sparkles className="h-6 w-6 text-yellow-400 animate-pulse" />
              </div>
            </div>
          </div>
          <CardTitle className="text-4xl font-extrabold bg-gradient-to-r from-green-600 via-emerald-600 to-green-800 bg-clip-text text-transparent mb-4 tracking-tight">
            Amnistia
          </CardTitle>
          <CardDescription className="text-base max-w-3xl mx-auto leading-relaxed text-gray-700 font-medium px-4">
            Per quale tipo di reato secondo te si dovrebbe concedere un'amnistia, ovvero la decisione dello Stato di cancellare la colpa e la pena per tutti quelli che lo hanno commesso?
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
};
