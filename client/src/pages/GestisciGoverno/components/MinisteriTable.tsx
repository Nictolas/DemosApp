import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Save, X as XIcon, Loader2 } from "lucide-react";
import { Ministero, MinisteroFormData } from "../types";
import { FORM_LABELS } from "../constants";

interface MinisteriTableProps {
  ministeri: Ministero[];
  editId: string | null;
  editForm: MinisteroFormData;
  setEditForm: (form: MinisteroFormData) => void;
  onStartEdit: (ministero: Ministero) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function MinisteriTable({
  ministeri,
  editId,
  editForm,
  setEditForm,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  isUpdating,
  isDeleting,
}: MinisteriTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border text-sm bg-white rounded shadow">
        <thead>
          <tr className="bg-yellow-100">
            <th className="px-3 py-2 border-b text-left">Nome</th>
            <th className="px-3 py-2 border-b text-left">Categoria</th>
            <th className="px-3 py-2 border-b text-left">Descrizione</th>
            <th className="px-3 py-2 border-b text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {ministeri.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center py-4">
                Nessun ministero presente.
              </td>
            </tr>
          )}
          {ministeri.map((m) => (
            <tr key={m.id} className="hover:bg-yellow-50">
              {editId === m.id ? (
                <>
                  <td className="px-3 py-2 border-b">
                    <Input 
                      value={editForm.nome} 
                      onChange={(e) => setEditForm({...editForm, nome: e.target.value})} 
                      required 
                    />
                  </td>
                  <td className="px-3 py-2 border-b">
                    <Input 
                      value={editForm.categoria} 
                      onChange={(e) => setEditForm({...editForm, categoria: e.target.value})} 
                      required 
                    />
                  </td>
                  <td className="px-3 py-2 border-b">
                    <Input 
                      value={editForm.descrizione} 
                      onChange={(e) => setEditForm({...editForm, descrizione: e.target.value})} 
                    />
                  </td>
                  <td className="px-3 py-2 border-b text-right flex gap-2 justify-end">
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700" 
                      disabled={isUpdating} 
                      onClick={onSaveEdit}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin"/>
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={onCancelEdit}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-3 py-2 border-b font-medium">{m.nome}</td>
                  <td className="px-3 py-2 border-b">{m.categoria}</td>
                  <td className="px-3 py-2 border-b text-muted-foreground">{m.descrizione}</td>
                  <td className="px-3 py-2 border-b text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => onStartEdit(m)}
                      >
                        <Pencil className="h-4 w-4 text-yellow-600" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => onDelete(m.id)} 
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
