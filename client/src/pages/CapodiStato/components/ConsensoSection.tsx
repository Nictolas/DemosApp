import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useToast } from '@/hooks/use-toast';

interface ConsensoData {
  mioConsenso: {
    risposta: string;
    timestamp: string;
  } | null;
  statistiche: {
    'Sì': number;
    'Non so': number;
    'No': number;
    totale: number;
  };
  blocco: {
    isBlocked: boolean;
    unlockDate: string | null;
  };
}

interface ConsensoSectionProps {
  data: ConsensoData;
  onVote: (risposta: string) => void;
  isVoting: boolean;
}

const COLORS = {
  'Sì': '#10b981', // green-500
  'Non so': '#f59e0b', // amber-500
  'No': '#ef4444' // red-500
};

export const ConsensoSection: React.FC<ConsensoSectionProps> = ({
  data,
  onVote,
  isVoting
}) => {
  const { toast } = useToast();

  // Prepara i dati per il grafico a torta
  const chartData = [
    { name: 'Sì', value: data.statistiche['Sì'], color: COLORS['Sì'] },
    { name: 'Non so', value: data.statistiche['Non so'], color: COLORS['Non so'] },
    { name: 'No', value: data.statistiche['No'], color: COLORS['No'] }
  ].filter(item => item.value > 0); // Mostra solo le opzioni con voti

  const percent = (value: number) =>
    data.statistiche.totale > 0 ? Math.round((value / data.statistiche.totale) * 100) : 0;

  const handleVote = (risposta: string) => {
    if (data.blocco.isBlocked) {
      toast({
        title: "Voto bloccato",
        description: "Hai già votato per il consenso questa settimana. Potrai votare di nuovo tra 7 giorni.",
        variant: "destructive"
      });
      return;
    }
    onVote(risposta);
  };

  const showResults = data.mioConsenso !== null && data.statistiche.totale > 0;

  return (
    <Card className="mb-0 shrink-0 border border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 px-3 py-3 sm:px-4 sm:py-4 [@media(max-height:650px)]:space-y-2 [@media(max-height:650px)]:py-2">
        <h2 className="text-center text-sm font-semibold leading-snug text-slate-900 sm:text-base">
          Ti senti rappresentato dall'attuale Capo di Stato?
        </h2>

        {/* Le tre risposte restano affiancate e centrate sull'intera card. */}
        <div className="mx-auto flex w-full max-w-sm justify-center" role="group" aria-label="Esprimi il tuo consenso">
          {[
            { value: 'Sì', color: 'bg-green-600 text-white' },
            { value: 'Non so', color: 'bg-yellow-500 text-white' },
            { value: 'No', color: 'bg-red-600 text-white' }
          ].map((option, idx) => (
            <button
              key={option.value}
              type="button"
              className={`min-h-11 flex-1 border border-slate-200 px-2 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:text-base ${
                idx === 0 ? 'rounded-l-full' : ''
              } ${
                idx === 2 ? 'rounded-r-full' : ''
              } ${
                data.mioConsenso?.risposta === option.value
                  ? option.color + ' relative z-10'
                  : 'bg-white text-slate-900 hover:bg-slate-50'
              }`}
              onClick={() => handleVote(option.value)}
              disabled={isVoting || data.blocco.isBlocked}
              aria-pressed={data.mioConsenso?.risposta === option.value}
            >
              {option.value}
            </button>
          ))}
        </div>

        {showResults && (
          <div className="mx-auto flex w-full max-w-lg min-w-0 items-center justify-center gap-3 sm:gap-5" aria-label="Grafico a torta consenso Capo di Stato">
            {/* Più grande su ogni schermo, ma adattabile ai telefoni bassi in orizzontale. */}
            <div
              className="h-24 w-24 shrink-0 min-[390px]:h-28 min-[390px]:w-28 lg:h-44 lg:w-44 [@media(max-height:650px)]:!h-20 [@media(max-height:650px)]:!w-20"
              data-testid="capo-consenso-pie-mobile"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius="34%"
                    outerRadius="89%"
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`consent-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} voti`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="min-w-0 text-left text-xs leading-relaxed text-slate-700 sm:text-sm">
              <p className="font-semibold">Totale voti: {data.statistiche.totale}</p>
              <p className="text-green-700">Sì: {data.statistiche['Sì']} ({percent(data.statistiche['Sì'])}%)</p>
              <p className="text-amber-700">Non so: {data.statistiche['Non so']} ({percent(data.statistiche['Non so'])}%)</p>
              <p className="text-red-700">No: {data.statistiche['No']} ({percent(data.statistiche['No'])}%)</p>
            </div>
          </div>
        )}

        {data.statistiche.totale === 0 && (
          <p className="text-center text-xs text-slate-500 sm:text-sm">
            Nessun voto di consenso ancora espresso.
          </p>
        )}

        {data.blocco.isBlocked && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-2 text-center lg:p-3">
            <p className="text-sm font-medium text-yellow-800">
              Hai già votato per il consenso questa settimana
            </p>
            <p className="text-xs text-yellow-700">
              Potrai votare di nuovo dal: {data.blocco.unlockDate ? new Date(data.blocco.unlockDate).toLocaleDateString('it-IT') : 'N/A'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
