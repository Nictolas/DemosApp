export default function handler(req, res) {
  res.status(200).json({
    bundleSize: 420,      // in KB
    apiCalls: 320000,     // al mese
    bandwidth: 41,        // in GB/mese
    trafficHistory: [12, 18, 22, 30, 35, 41] // dati per il grafico
  });
} 