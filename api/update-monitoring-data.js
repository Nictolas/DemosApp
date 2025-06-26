const fs = require('fs');
const path = require('path');

// TODO: Sostituisci con chiamate reali alle API Vercel/Firebase
const data = {
  bundleSize: 420,      // in KB
  apiCalls: 320000,     // al mese
  bandwidth: 41,        // in GB/mese
  trafficHistory: [12, 18, 22, 30, 35, 41] // dati per il grafico
};

const filePath = path.join(__dirname, 'monitoring-data.json');
fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('monitoring-data.json aggiornato!'); 