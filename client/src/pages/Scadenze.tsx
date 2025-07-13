import React from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

const SCADENZE = [
  {
    data: "Ottobre 2025",
    descrizione: "Aggiornare Node.js da versione 18 a 20 per le Cloud Functions Firebase (Node.js 18 va in End of Life)",
    stato: "Da fare"
  },
  // Qui puoi aggiungere altre scadenze in futuro
];

export default function Scadenze() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertCircle className="text-orange-500 h-6 w-6" />
            <CardTitle>Scadenze tecniche e avvisi</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption>Elenco delle principali scadenze tecniche da monitorare per l'app DEMOS.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SCADENZE.map((scad, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{scad.data}</TableCell>
                    <TableCell>{scad.descrizione}</TableCell>
                    <TableCell>{scad.stato}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 