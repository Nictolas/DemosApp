import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface ICEStatsChartProps {
  listaICE: any[];
}

const COLORS = {
  'Attuata': '#10b981', // Verde
  'In Attesa': '#f59e0b', // Giallo
  'Non Accolta': '#ef4444' // Rosso
};

export const ICEStatsChart: React.FC<ICEStatsChartProps> = ({ listaICE }) => {
  // Calcola le statistiche degli esiti
  const stats = React.useMemo(() => {
    const counts = {
      'Attuata': 0,
      'In Attesa': 0,
      'Non Accolta': 0
    };

    listaICE.forEach(ice => {
      const esito = ice.esito || 'In Attesa'; // Default se non specificato
      if (esito === 'Attuata' || esito === 'attuata') {
        counts['Attuata']++;
      } else if (esito === 'Non Accolta' || esito === 'non accolta' || esito === 'Non accolta') {
        counts['Non Accolta']++;
      } else {
        counts['In Attesa']++; // Tutti gli altri casi (inclusi null, undefined, 'In Attesa', etc.)
      }
    });

    return Object.entries(counts).map(([esito, count]) => ({
      name: esito,
      value: count,
      color: COLORS[esito as keyof typeof COLORS],
      percentage: listaICE.length > 0 ? Math.round((count / listaICE.length) * 100) : 0
    })).filter(item => item.value > 0); // Mostra solo le categorie con ICE
  }, [listaICE]);

  const total = listaICE.length;

  if (total === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Statistiche ICE
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Nessuna ICE disponibile per le statistiche
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          Statistiche ICE
        </CardTitle>
        <p className="text-sm text-gray-600">
          Distribuzione degli esiti delle {total} ICE
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
                    formatter={(value: number) => [`${value} ICE`, '']}
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
              Totale ICE: <span className="font-semibold text-gray-900">{total}</span>
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
