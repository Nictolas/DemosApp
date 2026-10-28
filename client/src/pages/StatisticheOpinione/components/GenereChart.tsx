import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Users } from "lucide-react";
import type { SessoDataItem } from "../types";

// Il nome del componente rimane per compatibilita' con la pagina legacy;
// i dati mostrati sono SOLO sesso anagrafico verificato CIE.
interface GenereChartProps {
  genereData: SessoDataItem[] | undefined;
}

const SEX_COLOR: Record<'M' | 'F', string> = {
  M: '#3b82f6',
  F: '#ec4899'
};

function asPieData(rows: SessoDataItem[], key: 'favorevole' | 'contrario') {
  return rows
    .filter(row => row.sesso === 'M' || row.sesso === 'F')
    .map(row => ({
      sesso: row.sesso,
      name: row.sesso === 'M' ? 'Maschile' : 'Femminile',
      value: Math.max(0, Number(row[key]) || 0)
    }))
    .filter(row => row.value > 0);
}

export function GenereChart({ genereData }: GenereChartProps) {
  const rows = Array.isArray(genereData) ? genereData : [];
  const charts = [
    { title: 'Favorevoli', data: asPieData(rows, 'favorevole') },
    { title: 'Contrari', data: asPieData(rows, 'contrario') }
  ];

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl text-gray-800 flex items-center">
          <Users className="mr-2 h-6 w-6 text-blue-600" />
          Distribuzione per sesso anagrafico (CIE)
        </CardTitle>
        <CardDescription>
          Dati verificati e aggregati. I piccoli gruppi vengono nascosti per proteggere la privacy.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {rows.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Dati non disponibili o insufficienti per questa suddivisione.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {charts.map(chart => (
              <div key={chart.title} className="text-center">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{chart.title}</h3>
                {chart.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chart.data}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {chart.data.map(entry => (
                          <Cell key={entry.sesso} fill={SEX_COLOR[entry.sesso]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500">Nessun dato disponibile</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
