import { db } from './firebase-admin.js';
import { getVercelUsage } from './vercel-usage.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const apiKey = req.headers['x-api-key'];
  const secret = process.env.MONITORING_UPDATE_SECRET || 'supersegreto';
  if (apiKey !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const usage = await getVercelUsage();
    const data = {
      bundleSize: 420, // aggiorna se vuoi calcolare anche questo
      apiCalls: usage.apiCalls,
      bandwidth: usage.bandwidth,
      trafficHistory: [12, 18, 22, 30, 35, usage.bandwidth],
    };
    await db.collection('monitoring').doc('consumi').set(data);
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Errore aggiornamento Firestore' });
  }
} 