import { db } from './firebase-admin.js';

export default async function handler(req, res) {
  try {
    const doc = await db.collection('monitoring').doc('consumi').get();
    if (!doc.exists) {
      return res.status(200).json({
        bundleSize: 0,
        apiCalls: 0,
        bandwidth: 0,
        trafficHistory: [],
      });
    }
    res.status(200).json(doc.data());
  } catch (e) {
    res.json({}); // 200 con oggetto vuoto
  }
} 