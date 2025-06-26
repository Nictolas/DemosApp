const { exec } = require('child_process');

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Protezione semplice: richiedi header X-API-KEY
  const apiKey = req.headers['x-api-key'];
  const secret = process.env.MONITORING_UPDATE_SECRET || 'supersegreto';
  if (apiKey !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  exec('node api/update-monitoring-data.js', (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: stderr || 'Errore aggiornamento dati' });
    }
    res.status(200).json({ success: true, output: stdout });
  });
} 