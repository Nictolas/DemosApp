import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Pencil, Trash2, ExternalLink, Check, Hourglass, X as XIcon } from "lucide-react";
import { ReferendumTableProps } from "../types";
import { QUORUM_COLORS, QUORUM_OPTIONS } from "../constants";

export const ReferendumTable: React.FC<ReferendumTableProps> = ({
  listaReferendum,
  isLoading,
  isError,
  onEdit,
  onDelete,
  onQuorumChange,
  deleteMutation,
  quorumMutation
}) => {
  // Funzione per gestire il cambio quorum
  const handleQuorumChange = (referendumId: string, newQuorum: string) => {
    onQuorumChange(referendumId, newQuorum as 'ok' | 'pending' | 'no');
  };

  if (isLoading) {
    return (
      <Card className="bg-white">
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Caricamento referendum...</p>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="bg-white">
        <CardContent className="p-8 text-center">
          <p className="text-red-600">Errore nel caricamento dei referendum</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>Lista Referendum Abrogativi</CardTitle>
        <CardDescription>
          Gestisci e monitora lo stato dei referendum abrogativi
        </CardDescription>
      </CardHeader>
      <CardContent>
        {listaReferendum.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Nessun referendum abrogativo trovato</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Data Inizio</TableHead>
                <TableHead>Data Fine</TableHead>
                <TableHead>Quorum</TableHead>
                <TableHead>Sito Web</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listaReferendum.map((referendum) => (
                <TableRow key={referendum.id}>
                  <TableCell className="font-medium">{referendum.nome}</TableCell>
                  <TableCell className="max-w-xs truncate">{referendum.descrizione}</TableCell>
                  <TableCell>{referendum.dataInizio}</TableCell>
                  <TableCell>{referendum.dataFine}</TableCell>
                  <TableCell>
                    <Select
                      value={referendum.quorum}
                      onValueChange={(value) => handleQuorumChange(referendum.id, value)}
                      disabled={quorumMutation.isPending}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue>
                          <div className="flex items-center space-x-2">
                            {referendum.quorum === 'ok' && <Check className="h-4 w-4 text-green-600" />}
                            {referendum.quorum === 'pending' && <Hourglass className="h-4 w-4 text-yellow-500" />}
                            {referendum.quorum === 'no' && <XIcon className="h-4 w-4 text-red-600" />}
                            <span className="text-sm">
                              {referendum.quorum === 'ok' ? 'Raggiunto' : 
                               referendum.quorum === 'pending' ? 'In corso' : 'Non raggiunto'}
                            </span>
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {QUORUM_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center space-x-2">
                              {option.value === 'ok' && <Check className="h-4 w-4 text-green-600" />}
                              {option.value === 'pending' && <Hourglass className="h-4 w-4 text-yellow-500" />}
                              {option.value === 'no' && <XIcon className="h-4 w-4 text-red-600" />}
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {referendum.sitoWeb && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(referendum.sitoWeb, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(referendum)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(referendum.id)}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
