import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Briefcase } from "lucide-react";
import { Link } from "wouter";

interface ProfileGovernoIdealeProps {
  governoIdeale: Record<string, string>;
  canEdit?: boolean;
}

export const ProfileGovernoIdeale = ({ governoIdeale, canEdit = true }: ProfileGovernoIdealeProps) => {
  const entries = Object.entries(governoIdeale || {});
  const readableRole = (role: string) =>
    role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <Card className="relative overflow-hidden border-0 shadow-md bg-white rounded-2xl">
      <CardHeader className="relative px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg lg:text-xl font-bold text-purple-700">
            <Crown className="h-5 w-5 shrink-0" />
            Il Tuo Governo Ideale
          </CardTitle>
          {canEdit && <Link
            href="/governo"
            className="hidden lg:inline-flex shrink-0 text-sm font-semibold text-blue-600 hover:underline"
          >
            Scegli Ministri
          </Link>}
        </div>
        <CardDescription className="text-sm text-gray-600">
          {entries.length} {entries.length === 1 ? "incarico selezionato" : "incarichi selezionati"}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">Nessun ministro selezionato.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {entries.map(([categoria, nome]) => (
              <div
                key={categoria}
                className="min-w-0 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  <span>{readableRole(categoria)}</span>
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-900 break-words">
                  {nome}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
