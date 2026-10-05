import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, CheckCircle, HelpCircle, XCircle } from "lucide-react";
import { categorizeOpinions } from '../utils/opinionUtils';
import { OpinionQuestion } from '../types';

interface ProfileOpinionsProps {
  userOpinions: Record<string, string>;
  opinionQuestions: OpinionQuestion[];
}

export const ProfileOpinions = ({ userOpinions, opinionQuestions }: ProfileOpinionsProps) => {
  if (!userOpinions || Object.keys(userOpinions).length === 0) {
    return null;
  }

  const categorized = categorizeOpinions(userOpinions, opinionQuestions);

  return (
    <div className="transform hover:scale-[1.02] transition-all duration-300">
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-linear-to-br from-white via-orange-50/30 to-amber-50/50 backdrop-blur-xs rounded-2xl">
        {/* Decorative background elements */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-linear-to-br from-orange-200/20 to-amber-200/20 rounded-full blur-xl"></div>
        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-linear-to-tr from-amber-200/20 to-orange-200/20 rounded-full blur-lg"></div>
        
        <CardHeader className="relative z-10">
          <CardTitle className="flex items-center gap-3 text-2xl font-bold bg-linear-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            <div className="p-2 rounded-xl bg-linear-to-br from-orange-100 to-amber-100">
              <MessageSquare className="h-6 w-6 text-orange-600" />
            </div>
            Le Tue Opinioni Politiche
          </CardTitle>
          <CardDescription className="text-lg text-gray-600 mt-2">
            Visualizzazione delle tue posizioni sui temi principali
          </CardDescription>
        </CardHeader>
        
        <CardContent className="relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Favorevoli */}
            <div className="group">
              <div className="bg-linear-to-br from-green-50 via-emerald-50/50 to-green-100/30 border border-green-200/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
                <h3 className="font-bold text-green-800 mb-4 flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-full bg-linear-to-br from-green-100 to-emerald-100">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  Favorevole
                </h3>
                <div className="space-y-3">
                  {categorized.favorevoli.length > 0 ? (
                    categorized.favorevoli.map(({ id, label }) => (
                      <div 
                        key={id} 
                        className="bg-linear-to-r from-green-50 to-emerald-50 border border-green-200/50 rounded-xl p-4 flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200 group-hover:scale-[1.02]"
                      >
                        <span className="text-green-800 font-semibold text-sm">{label}</span>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                    ))
                  ) : (
                    <div className="text-green-600 text-sm italic bg-green-50/50 rounded-xl p-4 text-center">
                      Nessuna opinione favorevole
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Indecisi */}
            <div className="group">
              <div className="bg-linear-to-br from-yellow-50 via-amber-50/50 to-yellow-100/30 border border-yellow-200/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
                <h3 className="font-bold text-yellow-800 mb-4 flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-full bg-linear-to-br from-yellow-100 to-amber-100">
                    <HelpCircle className="h-5 w-5 text-yellow-600" />
                  </div>
                  Indeciso
                </h3>
                <div className="space-y-3">
                  {categorized.indecisi.length > 0 ? (
                    categorized.indecisi.map(({ id, label }) => (
                      <div 
                        key={id} 
                        className="bg-linear-to-r from-yellow-50 to-amber-50 border border-yellow-200/50 rounded-xl p-4 flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200 group-hover:scale-[1.02]"
                      >
                        <span className="text-yellow-800 font-semibold text-sm">{label}</span>
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      </div>
                    ))
                  ) : (
                    <div className="text-yellow-600 text-sm italic bg-yellow-50/50 rounded-xl p-4 text-center">
                      Nessuna opinione indecisa
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contrari */}
            <div className="group">
              <div className="bg-linear-to-br from-red-50 via-rose-50/50 to-red-100/30 border border-red-200/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
                <h3 className="font-bold text-red-800 mb-4 flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-full bg-linear-to-br from-red-100 to-rose-100">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                  Contrario
                </h3>
                <div className="space-y-3">
                  {categorized.contrari.length > 0 ? (
                    categorized.contrari.map(({ id, label }) => (
                      <div 
                        key={id} 
                        className="bg-linear-to-r from-red-50 to-rose-50 border border-red-200/50 rounded-xl p-4 flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-200 group-hover:scale-[1.02]"
                      >
                        <span className="text-red-800 font-semibold text-sm">{label}</span>
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      </div>
                    ))
                  ) : (
                    <div className="text-red-600 text-sm italic bg-red-50/50 rounded-xl p-4 text-center">
                      Nessuna opinione contraria
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
