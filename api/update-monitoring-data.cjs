const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT = process.env.VERCEL_PROJECT || 'YOUR_PROJECT_NAME'; // Cambia con il nome del tuo progetto
const VERCEL_TEAM = process.env.VERCEL_TEAM || undefined; // opzionale

async function getVercelUsage() {
  const url = `https://api.vercel.com/v6/usage/web?projectId=${VERCEL_PROJECT}`;
  const headers = { Authorization: `Bearer ${VERCEL_TOKEN}` };
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Vercel API error');
    const data = await res.json();
    // Esempio: estrai bandwidth e invocazioni (adatta in base alla risposta reale)
    return {
      bandwidth: data.bandwidth?.currentPeriod?.used / (1024 * 1024 * 1024) || 0, // in GB
      apiCalls: data.serverlessInvocations?.currentPeriod?.count || 0,
    };
  } catch (e) {
    console.error('Errore fetch Vercel API:', e);
    return { bandwidth: 0, apiCalls: 0 };
  }
}

(async () => {
  const usage = await getVercelUsage();
  const data = {
    bundleSize: 420, // Puoi automatizzare anche questo in futuro
    apiCalls: usage.apiCalls,
    bandwidth: usage.bandwidth,
    trafficHistory: [12, 18, 22, 30, 35, usage.bandwidth] // aggiorna con dati reali se disponibili
  };
  const filePath = path.join(__dirname, 'monitoring-data.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log('monitoring-data.json aggiornato!');
})(); 