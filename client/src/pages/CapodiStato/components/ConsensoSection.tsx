import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className="mb-0 shrink-0 bg-white shadow-sm lg:mb-6 lg:mb-0">
      <CardHeader className="px-3 pb-1 pt-2.5 lg:p-6 lg:pb-2 lg:py-3">
        <CardTitle className="text-left text-base font-bold lg:text-center lg:text-xl lg:text-lg">
          Consenso
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-1 lg:px-6 lg:pb-6 lg:pt-0 lg:pb-3">
        <div className="space-y-2 lg:space-y-4 lg:space-y-3">
          {/* Domanda */}
          <div className="text-center">
            <h3 className="mb-2 text-sm font-semibold leading-snug text-gray-800 lg:mb-3 lg:text-lg lg:mb-2 lg:text-base">
              Ti senti rappresentato dall'attuale Capo di Stato?
            </h3>
            
            {/* Pulsanti di voto */}
            <div className="flex justify-center">
              <div className="flex w-full max-w-md">
                {[
                  { value: 'Sì', color: 'bg-green-600 text-white' },
                  { value: 'Non so', color: 'bg-yellow-500 text-white' },
                  { value: 'No', color: 'bg-red-600 text-white' }
                ].map((option, idx) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`min-h-11 flex-1 py-2 text-sm font-medium lg:py-3 lg:text-base lg:py-2 lg:text-sm transition-transform duration-150 focus:outline-none border border-gray-200 ${
                      idx === 0 ? 'rounded-l-full' : ''
                    } ${
                      idx === 2 ? 'rounded-r-full' : ''
                    } ${
                      data.mioConsenso?.risposta === option.value 
                        ? option.color + ' scale-95 z-10' 
                        : 'bg-white hover:bg-gray-10 z-0'
                    }`}
                    onClick={() => handleVote(option.value)}
                    disabled={isVoting || data.blocco.isBlocked}
                  >
                    {option.value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Torta a sinistra, statistiche a destra (PC) */}
          {showResults && (
            <div className="grid grid-cols-1 items-center gap-1 lg:grid-cols-2 lg:gap-4">
              <div className="hidden h-36 w-full lg:block lg:h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`${value} voti`, '']}
                      labelFormatter={(label: string) => `Risposta: ${label}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="min-w-0 space-y-1 text-left lg:space-y-2 lg:text-center lg:space-y-1.5 lg:text-left">
                <p className="text-xs text-gray-600 lg:text-sm">
                  Totale voti: <span className="font-semibold">{data.statistiche.totale}</span>
                </p>
                <div className="flex flex-col items-start gap-1 text-xs lg:items-center lg:text-sm lg:items-start">
                  <span className="text-green-600 font-medium">
                    Sì: {data.statistiche['Sì']} ({percent(data.statistiche['Sì'])}%)
                  </span>
                  <span className="text-yellow-600 font-medium">
                    Non so: {data.statistiche['Non so']} ({percent(data.statistiche['Non so'])}%)
                  </span>
                  <span className="text-red-600 font-medium">
                    No: {data.statistiche['No']} ({percent(data.statistiche['No'])}%)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Messaggio se non ci sono voti */}
          {data.statistiche.totale === 0 && (
            <div className="py-1 text-center text-xs text-gray-500 lg:py-2 lg:text-base">
              <p>Nessun voto di consenso ancora espresso.</p>
              <p className="hidden text-sm lg:block">Sii il primo a esprimere la tua opinione!</p>
            </div>
          )}

          {/* Messaggio di blocco */}
          {data.blocco.isBlocked && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-2 text-center lg:p-3">
              <p className="text-yellow-800 font-medium text-sm">
                Hai già votato per il consenso questa settimana
              </p>
              <p className="text-xs text-yellow-600">
                Potrai votare di nuovo dal: {data.blocco.unlockDate ? new Date(data.blocco.unlockDate).toLocaleDateString('it-IT') : 'N/A'}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
