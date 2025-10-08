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
      esito,
      count,
      percentage: listaICE.length > 0 ? Math.round((count / listaICE.length) * 100) : 0
    }));
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
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Grafico a torta */}
          <div className="w-full lg:w-1/2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="count"
                >
                  {stats.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[entry.esito as keyof typeof COLORS]} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any, name: any, props: any) => [
                    `${value} ICE (${props.payload.percentage}%)`,
                    props.payload.esito
                  ]}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value: any, entry: any) => (
                    <span style={{ color: entry.color }}>
                      {value} ({entry.payload.percentage}%)
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda dettagliata */}
          <div className="w-full lg:w-1/2 space-y-3">
            {stats.map((stat) => (
              <div key={stat.esito} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[stat.esito as keyof typeof COLORS] }}
                  />
                  <span className="font-medium text-gray-900">{stat.esito}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{stat.count}</div>
                  <div className="text-sm text-gray-600">{stat.percentage}%</div>
                </div>
              </div>
            ))}
            
            <div className="pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">Totale ICE</span>
                <span className="font-bold text-lg text-blue-600">{total}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
