import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Vote } from "lucide-react";
import { ElectionsListProps } from "./types";
import { ElectionCard } from "./ElectionCard";
import { ElectionsLoading } from "./ElectionsLoading";
import { ElectionsEmpty } from "./ElectionsEmpty";

export function ElectionsList({ elezioni, loading, onEdit, onDelete }: ElectionsListProps) {
  if (loading) {
    return <ElectionsLoading loading={loading} />;
  }

  if (elezioni.length === 0) {
    return <ElectionsEmpty elezioni={elezioni} />;
  }

  return (
    <Card className="bg-white border-0 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-2xl text-gray-800">
          <Calendar className="h-6 w-6 mr-3 text-blue-600" />
          Lista Elezioni
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {elezioni.map((elezione) => (
            <ElectionCard
              key={elezione.id}
              elezione={elezione}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
