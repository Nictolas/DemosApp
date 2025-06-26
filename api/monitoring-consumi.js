import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export default function handler(req, res) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.join(__dirname, 'monitoring-data.json');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    data = {
      bundleSize: 0,
      apiCalls: 0,
      bandwidth: 0,
      trafficHistory: []
    };
  }
  res.status(200).json(data);
} 