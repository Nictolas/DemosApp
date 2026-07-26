import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Building2, Users, Briefcase } from "lucide-react";

interface ProfileGovernoIdealeProps {
  governoIdeale: Record<string, string>;
}

export const ProfileGovernoIdeale = ({ governoIdeale }: ProfileGovernoIdealeProps) => {
  if (!governoIdeale || Object.keys(governoIdeale).length === 0) {
    return null;
  }

  // Funzione per ottenere l'icona appropriata per ogni categoria
  const getCategoryIcon = (categoria: string) => {
    const lowerCategoria = categoria.toLowerCase();
    if (lowerCategoria.includes('presidente') || lowerCategoria.includes('primo')) {
      return <Crown className="h-5 w-5 text-purple-600" />;
    } else if (lowerCategoria.includes('ministro') || lowerCategoria.includes('ministero')) {
      return <Building2 className="h-5 w-5 text-blue-600" />;
    } else if (lowerCategoria.includes('sottosegretario') || lowerCategoria.includes('vice')) {
      return <Users className="h-5 w-5 text-green-600" />;
    } else {
      return <Briefcase className="h-5 w-5 text-indigo-600" />;
    }
  };

  // Funzione per ottenere il colore appropriato per ogni categoria
  const getCategoryColor = (categoria: string) => {
    const lowerCategoria = categoria.toLowerCase();
    if (lowerCategoria.includes('presidente') || lowerCategoria.includes('primo')) {
      return {
        bg: 'from-purple-50 via-violet-50/50 to-purple-100/30',
        border: 'border-purple-200/50',
        text: 'text-purple-800',
        card: 'from-purple-50 to-violet-50',
        cardBorder: 'border-purple-200/50',
        name: 'text-purple-900'
      };
    } else if (lowerCategoria.includes('ministro') || lowerCategoria.includes('ministero')) {
      return {
        bg: 'from-blue-50 via-sky-50/50 to-blue-100/30',
        border: 'border-blue-200/50',
        text: 'text-blue-800',
        card: 'from-blue-50 to-sky-50',
        cardBorder: 'border-blue-200/50',
        name: 'text-blue-900'
      };
    } else if (lowerCategoria.includes('sottosegretario') || lowerCategoria.includes('vice')) {
      return {
        bg: 'from-green-50 via-emerald-50/50 to-green-100/30',
        border: 'border-green-200/50',
        text: 'text-green-800',
        card: 'from-green-50 to-emerald-50',
        cardBorder: 'border-green-200/50',
        name: 'text-green-900'
      };
    } else {
      return {
        bg: 'from-indigo-50 via-blue-50/50 to-indigo-100/30',
        border: 'border-indigo-200/50',
        text: 'text-indigo-800',
        card: 'from-indigo-50 to-blue-50',
        cardBorder: 'border-indigo-200/50',
        name: 'text-indigo-900'
      };
    }
  };

  return (
    <div>
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-white via-purple-50/30 to-violet-50/50 backdrop-blur-sm rounded-2xl">
        {/* Decorative background elements */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-purple-200/20 to-violet-200/20 rounded-full blur-xl"></div>
        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-gradient-to-tr from-violet-200/20 to-purple-200/20 rounded-full blur-lg"></div>
        
        <CardHeader className="relative z-10">
          <CardTitle className="flex items-center gap-3 text-xl lg:text-2xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 shrink-0">
              <Crown className="h-5 w-5 lg:h-6 lg:w-6 text-purple-600" />
            </div>
            Il Tuo Governo Ideale
          </CardTitle>
          <CardDescription className="text-base text-gray-600 mt-2">
            I ministri che hai selezionato per il tuo governo ideale
          </CardDescription>
        </CardHeader>
        
        <CardContent className="relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {Object.entries(governoIdeale).map(([categoria, nome]) => {
              const colors = getCategoryColor(categoria);
              return (
                <div 
                  key={categoria} 
                  className="group"
                >
                  <div className={`bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all duration-300`}>
                    <h3 className={`font-bold ${colors.text} mb-3 flex items-center gap-2 text-base`}>
                      <div className={`p-1.5 rounded-full bg-gradient-to-br ${colors.card} shrink-0`}>
                        {getCategoryIcon(categoria)}
                      </div>
                      <span className="leading-snug">{categoria.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    </h3>
                    <div className={`bg-gradient-to-r ${colors.card} border ${colors.cardBorder} rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-200`}>
                      <span className={`${colors.name} font-semibold text-sm break-words`}>{nome as string}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
