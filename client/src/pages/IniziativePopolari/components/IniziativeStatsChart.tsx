import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface IniziativeStatsChartProps {
  listaIniziative: any[];
}

const COLORS = {
  'Approvata': '#10b981', // Verde
  'In Attesa': '#f59e0b', // Giallo
  'Rifiutata': '#ef4444' // Rosso
};

export const IniziativeStatsChart: React.FC<IniziativeStatsChartProps> = ({ listaIniziative }) => {
  // Calcola le statistiche degli esiti
  const stats = React.useMemo(() => {
    const counts = {
      'Approvata': 0,
      'In Attesa': 0,
      'Rifiutata': 0
    };

    listaIniziative.forEach(iniziativa => {
      const esito = iniziativa.esito || 'In Attesa'; // Default se non specificato
      if (esito === 'Approvata' || esito === 'approvata') {
        counts['Approvata']++;
      } else if (esito === 'Rifiutata' || esito === 'rifiutata') {
        counts['Rifiutata']++;
      } else {
        counts['In Attesa']++; // Tutti gli altri casi (inclusi null, undefined, 'In Attesa', etc.)
      }
    });

    return Object.entries(counts).map(([esito, count]) => ({
      name: esito,
      value: count,
      color: COLORS[esito as keyof typeof COLORS],
      percentage: listaIniziative.length > 0 ? Math.round((count / listaIniziative.length) * 100) : 0
    })).filter(item => item.value > 0); // Mostra solo le categorie con iniziative
  }, [listaIniziative]);

  const total = listaIniziative.length;

  if (total === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Statistiche Iniziative Popolari
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Nessuna iniziativa popolare disponibile per le statistiche
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          Statistiche Iniziative Popolari
        </CardTitle>
        <p className="text-sm text-gray-600">
          Distribuzione degli esiti delle {total} iniziative popolari
        </p>
      </CardHeader>
      <CardContent>
        {total > 0 && (
          <div className="flex justify-center">
            <div className="w-full max-w-md h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {stats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value} iniziative`, '']}
                    labelFormatter={(label: string) => `Esito: ${label}`}
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
        {total > 0 && (
          <div className="text-center space-y-2 mt-4">
            <div className="text-sm text-gray-600">
              Totale iniziative: <span className="font-semibold text-gray-900">{total}</span>
            </div>
            <div className="flex justify-center gap-4 text-xs text-gray-500">
              {stats.map((stat) => (
                <span key={stat.name}>
                  {stat.name}: {stat.value} ({stat.percentage}%)
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
