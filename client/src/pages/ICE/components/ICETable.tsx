import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Trash2, ExternalLink, Check, Hourglass, X as XIcon } from "lucide-react";
import { ICETableProps } from "../types";

export const ICETable: React.FC<ICETableProps> = ({
  listaICE,
  mieiVoti,
  isLoading,
  isError,
  onView,
  onEdit,
  onDelete,
  deleteMutation
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-red-600">
        Errore nel caricamento delle ICE
      </div>
    );
  }

  if (listaICE.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nessuna ICE trovata
      </div>
    );
  }

  const getQuorumStatus = (quorum: string) => {
    switch (quorum) {
      case 'ok':
        return { icon: <Check className="h-4 w-4 text-green-600" />, text: 'Raggiunto', color: 'text-green-600' };
      case 'pending':
        return { icon: <Hourglass className="h-4 w-4 text-yellow-500" />, text: 'In corso', color: 'text-yellow-500' };
      case 'no':
        return { icon: <XIcon className="h-4 w-4 text-red-600" />, text: 'Non raggiunto', color: 'text-red-600' };
      default:
        return { icon: null, text: quorum, color: 'text-gray-600' };
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Azioni</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {listaICE.map((ice) => {
          const quorumStatus = getQuorumStatus(ice.quorum);
          const hasVoted = mieiVoti.includes(ice.id);
          
          return (
            <TableRow key={ice.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      ice.quorum === 'ok'
                        ? 'inline-block w-2.5 h-2.5 rounded-full bg-green-500'
                        : 'inline-block w-2.5 h-2.5 rounded-full bg-red-500'
                    }
                    aria-hidden="true"
                  />
                  {onView ? (
                    <button
                      className="text-blue-700 underline hover:text-blue-900 cursor-pointer"
                      onClick={() => onView(ice)}
                    >
                      {ice.nome}
                    </button>
                  ) : (
                    <span>{ice.nome}</span>
                  )}
                  {ice.nome === 'Save bees and farmers' && (
                    <span className="ml-2 text-sm text-red-600">non raggiunto</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(ice)}
                    disabled={deleteMutation.isPending}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(ice.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
