import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useToast } from '@/hooks/use-toast';

interface ConsensoGovernoData {
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

interface ConsensoGovernoSectionProps {
  data: ConsensoGovernoData;
  onVote: (risposta: string) => void;
  isVoting: boolean;
}

const COLORS = {
  'Sì': '#10b981', // green-500
  'Non so': '#f59e0b', // amber-500
  'No': '#ef4444' // red-500
};

export const ConsensoGovernoSection: React.FC<ConsensoGovernoSectionProps> = ({
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

  const handleVote = (risposta: string) => {
    if (data.blocco.isBlocked) {
      toast({
        title: "Voto bloccato",
        description: "Hai già votato per il consenso del governo questa settimana. Potrai votare di nuovo tra 7 giorni.",
        variant: "destructive"
      });
      return;
    }
    onVote(risposta);
  };

  return (
    <div style={{
      background: 'white',
      padding: '32px',
      borderRadius: '16px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
      border: '1px solid rgba(0,0,0,0.05)',
      marginBottom: '32px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '2px solid #f1f3f4'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '16px',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
        }}>
          <span style={{fontSize: '24px'}}>🏛️</span>
        </div>
        <div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#2d3748',
            margin: 0
          }}>
            Consenso Governo
          </h2>
          <p style={{
            fontSize: '14px',
            color: '#718096',
            margin: '4px 0 0 0'
          }}>
            Esprimi la tua opinione sull'attuale governo
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Domanda */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Ti senti rappresentato dall'attuale Governo?
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
                  className={`flex-1 py-3 text-base font-medium transition-transform duration-150 focus:outline-none border border-gray-200 ${
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

        {/* Grafico a torta */}
        {data.statistiche.totale > 0 && (
          <div className="flex justify-center">
            <div className="w-full max-w-md h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
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
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value: string) => (
                      <span className="text-sm font-medium">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Statistiche testuali */}
        {data.statistiche.totale > 0 && (
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              Totale voti: <span className="font-semibold">{data.statistiche.totale}</span>
            </p>
            <div className="flex justify-center space-x-4 text-sm">
              <span className="text-green-600 font-medium">
                Sì: {data.statistiche['Sì']} ({data.statistiche.totale > 0 ? Math.round((data.statistiche['Sì'] / data.statistiche.totale) * 100) : 0}%)
              </span>
              <span className="text-yellow-600 font-medium">
                Non so: {data.statistiche['Non so']} ({data.statistiche.totale > 0 ? Math.round((data.statistiche['Non so'] / data.statistiche.totale) * 100) : 0}%)
              </span>
              <span className="text-red-600 font-medium">
                No: {data.statistiche['No']} ({data.statistiche.totale > 0 ? Math.round((data.statistiche['No'] / data.statistiche.totale) * 100) : 0}%)
              </span>
            </div>
          </div>
        )}

        {/* Messaggio se non ci sono voti */}
        {data.statistiche.totale === 0 && (
          <div className="text-center text-gray-500 py-4">
            <p>Nessun voto di consenso del governo ancora espresso.</p>
            <p className="text-sm">Sii il primo a esprimere la tua opinione!</p>
          </div>
        )}

        {/* Messaggio di blocco */}
        {data.blocco.isBlocked && (
          <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 font-medium">
              Hai già votato per il consenso del governo questa settimana
            </p>
            <p className="text-sm text-yellow-600">
              Potrai votare di nuovo dal: {data.blocco.unlockDate ? new Date(data.blocco.unlockDate).toLocaleDateString('it-IT') : 'N/A'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
